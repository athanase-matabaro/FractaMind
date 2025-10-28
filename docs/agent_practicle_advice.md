Short explanation and practical advice (so you don’t have to ask later)

Why Morton (Z-order)?
It’s extremely simple to implement and gives good locality preservation for our purpose. Hilbert is slightly better but more work; for a hackathon Morton is fast to ship.

Embedding reduction
I made reduceEmbedding accept simple strategies:

first (fastest) — use the first D dimensions returned by the embedding API. Often adequate.

blockavg — averages sections of the vector to get D dims; useful when you don’t want to throw away tail dims.
Replace with a small PCA or random projection later for better locality.

Quantization params
Collect a small sample (e.g., top 200 nodes) to compute mins/maxs per reduced dim. Store quantParams per project in IndexedDB (so future quantization is consistent).

Radius selection for range scanning
Start small (e.g., radius = 2^k) and widen until you find enough candidates. I included rangeScanByMortonHex with a numeric-radius option.

Storage and types
I store hilbertKeyHex as a hex string to keep IDB ordering and to avoid BigInt serialization hassles.

Later improvements

Replace reduceEmbedding with PCA/RandomProjection (WASM or JS).

Implement approximate nearest neighbor (ANN) on-device (e.g., HNSW in WASM) if you grow beyond a few thousand nodes.

Use a tiny evicting cache of embeddings (Float32Array) in memory for faster re-ranking.