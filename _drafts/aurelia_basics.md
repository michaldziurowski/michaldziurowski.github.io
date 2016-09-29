---
layout: post
title: Aurelia basics
tags: [aurelia]
---
To installa Aurelia you will need:

*	[npm](https://www.npmjs.com/) - package manager, basically you can think of it as a package manager you will use to download development tools
*	[jspm](http://jspm.io/) - also a package manager, install it using npm, basically you will use it for downloading your application dependencies (and then load them in ES6 style using [SystemJS](https://github.com/systemjs/systemjs))

In a directory where you would like to store source code for your app initialize jspm.

```
$ jspm init
```

It will ask some questions. You can leave all options default just pay attention to last one when choosing transpiler for your javascript code. I choose TypeScript.
Then install aurelia-framework and aurelia-bootstrapper (used for bootstrapping Aurelia into your application)

```
$ jspm install aurelia-framework aurelia-bootstrapper
```

change config.js add package default extension (try changing defaultjsextension to false)

Create index.html and app.ts and app.html
