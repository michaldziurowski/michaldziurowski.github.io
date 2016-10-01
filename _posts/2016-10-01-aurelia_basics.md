---
layout: post
title: Aurelia basics
tags: [aurelia, typescript, npm, jspm, http-server]
---
To install Aurelia you will need:

*	[npm](https://www.npmjs.com/) - package manager, basically you can think of it as a package manager you will use to download development tools
*	[jspm](http://jspm.io/) - also a package manager, install it using npm, basically you will use it for downloading your application dependencies (and then load them in ES6 style using [SystemJS](https://github.com/systemjs/systemjs))

In a directory where you would like to store your app initialize jspm:

```
$ jspm init
```

It will ask some questions. You can leave all options default just pay attention to last one when choosing transpiler for your javascript code. I choose TypeScript.
Then install aurelia-framework and aurelia-bootstrapper (used for bootstrapping Aurelia into your application):

```
$ jspm install aurelia-framework aurelia-bootstrapper
```
Lets assume source code of our application will be located in `src` directory. Now we have to change config.js (created by jspm) to ensure that it will understand TypeScript code located in `src` directory.
First add following for SystemJS to understand where our source code is:

```
paths: {
    "*": "scr/*",
    [other paths leave as they were]
  },
```

And now we have to make sure that SystemJS understands TypeScript files inside `src` directory:


```
packages: {
    "/src": {
      "defaultExtension": "ts"
    }
  },
```

Ok, now environment is ready so lets create this killer app.
First we need to create `index.html` page as a start page for our application. Locate it in main directory of our app.
In this file we need to do 3 things:

1. Import scripts for module loader (systemjs and its config)

   ```html
   <script src="jspm_packages/system.js"></script>
   <script src="config.js"></script>
   ```

2. Load Aurelias bootstrapper

   ```html
   <script>
   	System.import("aurelia-bootstrapper");
   </script>
   ```

3. Point where Aurelias templates should be loaded

   ```html
   <body aurelia-app>
   ```

Finally our `index.html` file will look like this:

```html
<html>
  <head>
    <title>Aurelia basic app</title>
  </head>
<body aurelia-app>
    <script src="jspm_packages/system.js"></script>
    <script src="config.js"></script>
    <script>
      System.import("aurelia-bootstrapper");
    </script>
</body>
</html>
```

Now lets create the app itself. 
Following Aurelias convention main module of our application should be named `app` (this of course can be changed). Module is in most cases set of two files js (ts) view model class and view template for it. Both those files should be named the same as the module we are providing (in this case app.ts(app.js) and app.html)
Our application will allow to display text which was put to textbox (WOW!).

First lets create view model class in `src` directory (app.ts). Our view model will only have one text property which will be used for storing text which we put in textbox.

```javascript
export class KillerApp {
    name: string;
}
```

Now lets create view template for it:

```html
<template>
    <h1>${name}</h1>
    <input type="text" value.bind="name" />
</template>
```

Few things to notice here:
* view has to be wrapped in Web Components `template` element
* ${} provides one way binding from your view model to view
* .bind added to parameter provides binding on this parameter. Aurelia decides whether this should be a one way (e.g. `<img src.bind="property" />`) or two way (like in this case).

That's is! Our application structure should look similar to this:
![Application structure](/images/aurelia_basics/app_structure.png)

Now we can run it with [http-server](https://www.npmjs.com/package/http-server) or any http server of our choosing.
