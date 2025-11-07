module.exports = {
  presets: [
    [
      '@babel/preset-env',
      {
        targets: {
          node: 'current',
        },
      },
    ],
    [
      '@babel/preset-react',
      {
        runtime: 'automatic',
      },
    ],
  ],
  plugins: [
    // Custom plugin to transform import.meta to global.importMeta
    function () {
      return {
        name: 'transform-import-meta',
        visitor: {
          MetaProperty(path) {
            // Transform import.meta to global.importMeta
            if (path.node.meta.name === 'import' && path.node.property.name === 'meta') {
              path.replaceWithSourceString('global.importMeta');
            }
          },
        },
      };
    },
  ],
};
