/* fractamind-indexer.js
   Minimal IndexedDB wrapper + Morton (Z-order) key generator for embeddings.

   Usage:
     await initDB();
     // compute quantParams from a set of embeddings (see computeQuantizationParams)
     const mortonKeyHex = computeMortonKeyFromEmbedding(vec, quantParams);
     await saveNode({ id, title, text, embedding: vec, hilbertKeyHex: mortonKeyHex, meta });
     const hits = await rangeScanByMortonHex(mortonKeyHex, radiusHex, { limit: 200 });
*/

/////////////////////////
// CONFIG / CONSTANTS //
/////////////////////////
const DB_NAME = 'fractamind-db';
const DB_VERSION = 1;
const STORE_NODES = 'nodes';
const STORE_MORTON = 'mortonIndex'; // maps mortonHex -> nodeId (multiple entries allowed per key)
const EPS = 1e-9;

/////////////////////////
// IndexedDB helpers  //
/////////////////////////
function openIndexedDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (ev) => {
      const db = ev.target.result;
      if (!db.objectStoreNames.contains(STORE_NODES)) {
        const nodesStore = db.createObjectStore(STORE_NODES, { keyPath: 'id' });
        nodesStore.createIndex('byMorton', 'hilbertKeyHex', { unique: false });
      }
      if (!db.objectStoreNames.contains(STORE_MORTON)) {
        // store entries { mortonHex, nodeId }
        const mort = db.createObjectStore(STORE_MORTON, { keyPath: ['mortonHex', 'nodeId'] });
        mort.createIndex('mortonIdx', 'mortonHex', { unique: false });
      }
    };
    req.onsuccess = (ev) => resolve(ev.target.result);
    req.onerror = (ev) => reject(ev.target.error);
  });
}

async function withDB(fn) {
  const db = await openIndexedDB();
  return fn(db);
}

function promisifyRequest(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = (ev) => resolve(ev.target.result);
    req.onerror = (ev) => reject(ev.target.error);
  });
}

/////////////////////////
// Node CRUD functions //
/////////////////////////
async function saveNode(node) {
  // node: { id, title, text, embedding (Array), hilbertKeyHex, meta }
  return withDB((db) =>
    new Promise((resolve, reject) => {
      const tx = db.transaction([STORE_NODES, STORE_MORTON], 'readwrite');
      const nodes = tx.objectStore(STORE_NODES);
      nodes.put(node);
      if (node.hilbertKeyHex) {
        const mort = tx.objectStore(STORE_MORTON);
        // Allow multiple nodeIds per morton key.
        mort.put({ mortonHex: node.hilbertKeyHex, nodeId: node.id });
      }
      tx.oncomplete = () => resolve(node);
      tx.onerror = (ev) => reject(ev.target.error);
    })
  );
}

async function getNode(id) {
  return withDB((db) => promisifyRequest(db.transaction([STORE_NODES]).objectStore(STORE_NODES).get(id)));
}

async function deleteNode(id) {
  return withDB((db) =>
    new Promise((resolve, reject) => {
      const tx = db.transaction([STORE_NODES, STORE_MORTON], 'readwrite');
      tx.objectStore(STORE_NODES).delete(id);
      // remove any mortonIndex entries for this nodeId
      const mort = tx.objectStore(STORE_MORTON);
      const idx = mort.index('mortonIdx');
      const req = idx.openCursor();
      req.onsuccess = (ev) => {
        const cursor = ev.target.result;
        if (!cursor) return;
        const rec = cursor.value;
        if (rec.nodeId === id) {
          cursor.delete();
        }
        cursor.continue();
      };
      tx.oncomplete = () => resolve(true);
      tx.onerror = (ev) => reject(ev.target.error);
    })
  );
}

/////////////////////////
// Range scan helpers  //
/////////////////////////
async function rangeScanByMortonHex(centerHex, radiusHexOrNumber = null, { limit = 500 } = {}) {
  // If radiusHexOrNumber is null => exact match fetch of centerHex keys
  // If it's a number, treat it as +/- numeric offset on BigInt.
  // If it's a hex string, treat as +/- between hex strings.
  return withDB(async (db) => {
    const mort = db.transaction(STORE_MORTON).objectStore(STORE_MORTON);
    const results = [];
    if (!radiusHexOrNumber) {
      // exact equality cursor
      const index = mort.index('mortonIdx');
      const range = IDBKeyRange.only(centerHex);
      const req = index.openCursor(range);
      await new Promise((resolve, reject) => {
        req.onsuccess = (ev) => {
          const cur = ev.target.result;
          if (!cur || results.length >= limit) return resolve();
          results.push(cur.value.nodeId);
          cur.continue();
        };
        req.onerror = (ev) => reject(ev.target.error);
      });
      return results;
    }

    // Interpret centerHex -> BigInt
    const center = BigInt('0x' + strip0x(centerHex));
    const rad = typeof radiusHexOrNumber === 'number' ? BigInt(radiusHexOrNumber) : BigInt('0x' + strip0x(radiusHexOrNumber));
    const low = center - rad;
    const high = center + rad;
    const lowHex = bigIntToHex(low);
    const highHex = bigIntToHex(high);

    // open index and scan range
    const index = mort.index('mortonIdx');
    const range = IDBKeyRange.bound(lowHex, highHex);
    const req = index.openCursor(range);
    await new Promise((resolve, reject) => {
      req.onsuccess = (ev) => {
        const cur = ev.target.result;
        if (!cur || results.length >= limit) return resolve();
        results.push(cur.value.nodeId);
        cur.continue();
      };
      req.onerror = (ev) => reject(ev.target.error);
    });
    return results;
  });
}

/////////////////////////
// Quantization + Morton
/////////////////////////

/*
 Strategy:
 1) Optionally reduce embedding to first `reducedDims` dims (or block-average).
 2) Normalize each reduced dim using provided min/max arrays (per-project).
 3) Quantize to integer in [0, 2^bits-1].
 4) Interleave bits across dims (most-significant bit first) into a BigInt.
 5) Return hex string without 0x prefix (to store in IndexedDB).
*/

function strip0x(hex) {
  return hex.startsWith('0x') ? hex.slice(2) : hex;
}
function bigIntToHex(big) {
  if (big < 0n) throw new Error('Negative BigInt not supported');
  return big.toString(16).padStart(1, '0');
}

// Compute quantization parameters (mins/maxs) from a set of embeddings (Array of Array)
function computeQuantizationParams(embeddings, { reducedDims = 8, bits = 16, reduction = 'first' } = {}) {
  // reduction: 'first' (take first reducedDims), 'blockavg' (average blocks)
  if (!embeddings || embeddings.length === 0) {
    throw new Error('Need at least one embedding to compute quant params');
  }
  const dim = embeddings[0].length;
  const rd = Math.min(reducedDims, dim);
  // Build reduced embeddings
  const reduced = embeddings.map((e) => reduceEmbedding(e, rd, reduction));
  // compute mins/maxs per reduced dim
  const mins = Array(rd).fill(Infinity);
  const maxs = Array(rd).fill(-Infinity);
  for (const r of reduced) {
    for (let i = 0; i < rd; i++) {
      const v = Number(r[i] ?? 0);
      if (Number.isFinite(v)) {
        mins[i] = Math.min(mins[i], v);
        maxs[i] = Math.max(maxs[i], v);
      } else {
        mins[i] = Math.min(mins[i], 0);
        maxs[i] = Math.max(maxs[i], 0);
      }
    }
  }
  // Avoid degenerate ranges
  for (let i = 0; i < rd; i++) {
    if (!isFinite(mins[i])) mins[i] = 0;
    if (!isFinite(maxs[i]) || Math.abs(maxs[i] - mins[i]) < EPS) {
      // create small symmetric range around value
      maxs[i] = mins[i] + 1e-6;
    }
  }
  return { reducedDims: rd, bits, mins, maxs, reduction };
}

function reduceEmbedding(emb, rd, reduction = 'first') {
  if (reduction === 'first') {
    return emb.slice(0, rd);
  } else if (reduction === 'blockavg') {
    // split emb into rd blocks and average each block
    const res = [];
    const blockSize = Math.floor(emb.length / rd);
    for (let i = 0; i < rd; i++) {
      const start = i * blockSize;
      const end = i === rd - 1 ? emb.length : start + blockSize;
      let s = 0,
        c = 0;
      for (let j = start; j < end; j++) {
        const val = Number(emb[j] ?? 0);
        if (!Number.isFinite(val)) continue;
        s += val;
        c++;
      }
      res.push(c > 0 ? s / c : 0);
    }
    return res;
  } else {
    throw new Error('Unknown reduction method: ' + reduction);
  }
}

function quantizeReduced(reducedVec, mins, maxs, bits = 16) {
  const levels = (1 << bits) - 1;
  const q = new Array(reducedVec.length);
  for (let i = 0; i < reducedVec.length; i++) {
    const v = Number(reducedVec[i] ?? 0);
    const min = mins[i];
    const max = maxs[i];
    // normalize to [0,1]
    const norm = (v - min) / (max - min + EPS);
    const clipped = Math.min(1, Math.max(0, norm));
    q[i] = Math.floor(clipped * levels);
  }
  return q;
}

// Interleave bits (MSB-first across bit positions) to form a BigInt Morton key
function interleaveBitsToBigInt(quantizedArray, bits = 16) {
  // quantizedArray length = dims
  let key = 0n;
  for (let b = bits - 1; b >= 0; b--) {
    for (let d = 0; d < quantizedArray.length; d++) {
      const bit = (quantizedArray[d] >> b) & 1;
      key = (key << 1n) | BigInt(bit);
    }
  }
  return key;
}

// Public helper: compute morton hex from embedding using quantParams
function computeMortonKeyFromEmbedding(embedding, quantParams) {
  const { reducedDims, bits, mins, maxs, reduction } = quantParams;
  const reduced = reduceEmbedding(embedding, reducedDims, reduction);
  const quant = quantizeReduced(reduced, mins, maxs, bits);
  const key = interleaveBitsToBigInt(quant, bits);
  return bigIntToHex(key);
}

/////////////////////////
// Initialization API  //
/////////////////////////
async function initDB() {
  // open once to force upgrade
  const db = await openIndexedDB();
  db.close();
  return true;
}

/////////////////////////
// EXAMPLES / USAGE    //
/////////////////////////

/* Example usage:
(async () => {
  await initDB();

  // Suppose you have sample embeddings to compute quant params:
  const sampleEmbeddings = [
    // each is an Array<number>
    [0.12, -0.32, 0.47, ...],
    ...
  ];
  const quantParams = computeQuantizationParams(sampleEmbeddings, { reducedDims: 8, bits: 16, reduction: 'first' });

  // For a new node embedding:
  const nodeEmbedding = [ /* ... * / ];
  const mortonHex = computeMortonKeyFromEmbedding(nodeEmbedding, quantParams);

  const node = {
    id: 'node-uuid-1',
    title: 'Causes of urban heat islands',
    text: '...',
    embedding: nodeEmbedding,
    hilbertKeyHex: mortonHex,
    meta: { createdAt: new Date().toISOString(), createdBy: 'local' }
  };

  await saveNode(node);

  // Range search: radius = 0x100 (as BigInt)
  const neighborsNodeIds = await rangeScanByMortonHex(mortonHex, 0x100);
  console.log('neighbor ids', neighborsNodeIds);

  // Get node details:
  const got = await getNode('node-uuid-1');
  console.log(got);
})();
*/

/////////////////////////
// Export for modules  //
/////////////////////////
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    initDB,
    saveNode,
    getNode,
    deleteNode,
    rangeScanByMortonHex,
    computeQuantizationParams,
    computeMortonKeyFromEmbedding,
    reduceEmbedding,
  };
} else {
  // attach to window for browser global usage
  window.FractamindIndexer = {
    initDB,
    saveNode,
    getNode,
    deleteNode,
    rangeScanByMortonHex,
    computeQuantizationParams,
    computeMortonKeyFromEmbedding,
    reduceEmbedding,
  };
}
