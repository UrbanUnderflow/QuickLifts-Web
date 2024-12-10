self.__BUILD_MANIFEST = {
  "polyfillFiles": [
    "static/chunks/polyfills.js"
  ],
  "devFiles": [
    "static/chunks/react-refresh.js"
  ],
  "ampDevFiles": [],
  "lowPriorityFiles": [],
  "rootMainFiles": [],
  "pages": {
    "/_app": [
      "static/chunks/webpack.js",
      "static/chunks/main.js",
      "static/chunks/pages/_app.js"
    ],
    "/_error": [
      "static/chunks/webpack.js",
      "static/chunks/main.js",
      "static/chunks/pages/_error.js"
    ],
    "/checklist": [
      "static/chunks/webpack.js",
      "static/chunks/main.js",
      "static/chunks/pages/checklist.js"
    ],
    "/notification-test": [
      "static/chunks/webpack.js",
      "static/chunks/main.js",
      "static/chunks/pages/notification-test.js"
    ],
    "/profile/[username]": [
      "static/chunks/webpack.js",
      "static/chunks/main.js",
      "static/chunks/pages/profile/[username].js"
    ],
    "/starter-pack": [
      "static/chunks/webpack.js",
      "static/chunks/main.js",
      "static/chunks/pages/starter-pack.js"
    ]
  },
  "ampFirstPages": []
};
self.__BUILD_MANIFEST.lowPriorityFiles = [
"/static/" + process.env.__NEXT_BUILD_ID + "/_buildManifest.js",
,"/static/" + process.env.__NEXT_BUILD_ID + "/_ssgManifest.js",

];