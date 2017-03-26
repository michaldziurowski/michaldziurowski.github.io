---
layout: post
title: React TypeScript Webpack2
tags: [react, typescript, webpack]
---
If you are using tutorial from [typescript doc](https://www.typescriptlang.org/docs/handbook/react-&-webpack.html) for setting up basic react + typescript installation you may encounter a little hickup on the way ;) :

```
$ webpack
Invalid configuration object. Webpack has been initialised using a configuration object that does not match
the API schema.
 - configuration.module has an unknown property 'preLoaders'. These properties are valid:
   object { exprContextCritical?, exprContextRecursive?, exprContextRegExp?, exprContextRequest?, loaders?,
noParse?, rules?, unknownContextCritical?, unknownContextRecursive?, unknownContextRegExp?, unknownContextRe
quest?, unsafeCache?, wrappedContextCritical?, wrappedContextRecursive?, wrappedContextRegExp? }
   Options affecting the normal modules (`NormalModuleFactory`).
 - configuration.resolve.extensions[0] should not be empty.
```

There are two reasons for that:

1. New versions of webpack do not support preLoaders (since version [2.1.0-beta.23](https://github.com/webpack/webpack/releases/tag/v2.1.0-beta.23))
2. Empty string "" in extensions

Working **webpack.config.js** looks like this:

```javascript
module.exports = {
    entry: "./src/index.tsx",
    output: {
        filename: "bundle.js",
        path: __dirname + "/dist"
    },
    devtool: "source-map",
    resolve: {
        extensions: [".webpack.js", ".web.js", ".ts", ".tsx", ".js"]
    },
    module: {
        rules: [
            { test: /\.tsx?$/, loader: "awesome-typescript-loader" },
            { test: /\.js$/, enforce: "pre", loader: "source-map-loader" }
        ]
    },
    externals: {
        "react": "React",
        "react-dom": "ReactDOM"
    },
};
```

Changes:
1. loaders replaced by rules
2. preLoader replaced by rules
3. Removed empty string from extensions