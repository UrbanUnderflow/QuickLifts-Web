"use strict";
/*
 * ATTENTION: An "eval-source-map" devtool has been used.
 * This devtool is neither made for production nor for readable output files.
 * It uses "eval()" calls to create a separate source file with attached SourceMaps in the browser devtools.
 * If you are trying to read the output file, select a different devtool (https://webpack.js.org/configuration/devtool/)
 * or disable the default devtool with "devtool: false".
 * If you are looking for production-ready output files, see mode: "production" (https://webpack.js.org/configuration/mode/).
 */
self["webpackHotUpdate_N_E"]("pages/user-dashboard",{

/***/ "./src/pages/user-dashboard.tsx":
/*!**************************************!*\
  !*** ./src/pages/user-dashboard.tsx ***!
  \**************************************/
/***/ (function(module, __webpack_exports__, __webpack_require__) {

eval(__webpack_require__.ts("__webpack_require__.r(__webpack_exports__);\n/* harmony import */ var _swc_helpers_async_to_generator__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! @swc/helpers/_/_async_to_generator */ \"./node_modules/@swc/helpers/esm/_async_to_generator.js\");\n/* harmony import */ var _swc_helpers_sliced_to_array__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! @swc/helpers/_/_sliced_to_array */ \"./node_modules/@swc/helpers/esm/_sliced_to_array.js\");\n/* harmony import */ var _swc_helpers_ts_generator__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! @swc/helpers/_/_ts_generator */ \"./node_modules/@swc/helpers/esm/_ts_generator.js\");\n/* harmony import */ var react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! react/jsx-dev-runtime */ \"./node_modules/react/jsx-dev-runtime.js\");\n/* harmony import */ var react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_0__);\n/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! react */ \"./node_modules/react/index.js\");\n/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(react__WEBPACK_IMPORTED_MODULE_1__);\n\n\n\nvar _this = undefined;\n\nvar _s = $RefreshSig$();\n\nvar UserDashboard = function() {\n    _s();\n    var _useState = (0,_swc_helpers_sliced_to_array__WEBPACK_IMPORTED_MODULE_2__._)((0,react__WEBPACK_IMPORTED_MODULE_1__.useState)([]), 2), userStats = _useState[0], setUserStats = _useState[1];\n    var _useState1 = (0,_swc_helpers_sliced_to_array__WEBPACK_IMPORTED_MODULE_2__._)((0,react__WEBPACK_IMPORTED_MODULE_1__.useState)(true), 2), loading = _useState1[0], setLoading = _useState1[1];\n    var _useState2 = (0,_swc_helpers_sliced_to_array__WEBPACK_IMPORTED_MODULE_2__._)((0,react__WEBPACK_IMPORTED_MODULE_1__.useState)(null), 2), error = _useState2[0], setError = _useState2[1];\n    (0,react__WEBPACK_IMPORTED_MODULE_1__.useEffect)(function() {\n        var fetchWorkoutSummaries = function() {\n            var _ref = (0,_swc_helpers_async_to_generator__WEBPACK_IMPORTED_MODULE_3__._)(function() {\n                var apiUrl, response, data, userWorkouts, statsArray, err;\n                return (0,_swc_helpers_ts_generator__WEBPACK_IMPORTED_MODULE_4__._)(this, function(_state) {\n                    switch(_state.label){\n                        case 0:\n                            _state.trys.push([\n                                0,\n                                3,\n                                4,\n                                5\n                            ]);\n                            setLoading(true);\n                            apiUrl =  true ? \"http://localhost:8888/.netlify/functions\" : 0;\n                            return [\n                                4,\n                                fetch(\"\".concat(apiUrl, \"/get-all-workout-summaries\"))\n                            ];\n                        case 1:\n                            response = _state.sent();\n                            if (!response.ok) {\n                                throw new Error(\"Failed to fetch workout summaries\");\n                            }\n                            return [\n                                4,\n                                response.json()\n                            ];\n                        case 2:\n                            data = _state.sent();\n                            // Group workouts by user\n                            userWorkouts = data.summaries.reduce(function(acc, summary) {\n                                var _summary_user = summary.user, userId = _summary_user.userId, username = _summary_user.username;\n                                if (!acc[userId]) {\n                                    acc[userId] = {\n                                        userId: userId,\n                                        username: username,\n                                        workoutCount: 0\n                                    };\n                                }\n                                acc[userId].workoutCount += 1;\n                                return acc;\n                            }, {});\n                            // Convert to array and sort by workout count\n                            statsArray = Object.values(userWorkouts).sort(function(a, b) {\n                                return b.workoutCount - a.workoutCount;\n                            });\n                            setUserStats(statsArray);\n                            return [\n                                3,\n                                5\n                            ];\n                        case 3:\n                            err = _state.sent();\n                            setError(err instanceof Error ? err.message : \"An unknown error occurred\");\n                            return [\n                                3,\n                                5\n                            ];\n                        case 4:\n                            setLoading(false);\n                            return [\n                                7\n                            ];\n                        case 5:\n                            return [\n                                2\n                            ];\n                    }\n                });\n            });\n            return function fetchWorkoutSummaries() {\n                return _ref.apply(this, arguments);\n            };\n        }();\n        fetchWorkoutSummaries();\n    }, []);\n    if (loading) {\n        return /*#__PURE__*/ (0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxDEV)(\"div\", {\n            className: \"flex justify-center items-center h-screen\",\n            children: \"Loading...\"\n        }, void 0, false, {\n            fileName: \"/Users/tre/Documents/GitHub/QuickLifts-web/src/pages/user-dashboard.tsx\",\n            lineNumber: 55,\n            columnNumber: 12\n        }, _this);\n    }\n    if (error) {\n        return /*#__PURE__*/ (0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxDEV)(\"div\", {\n            className: \"flex justify-center items-center h-screen text-red-500\",\n            children: [\n                \"Error: \",\n                error\n            ]\n        }, void 0, true, {\n            fileName: \"/Users/tre/Documents/GitHub/QuickLifts-web/src/pages/user-dashboard.tsx\",\n            lineNumber: 60,\n            columnNumber: 7\n        }, _this);\n    }\n    return /*#__PURE__*/ (0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxDEV)(\"div\", {\n        className: \"p-6\",\n        children: [\n            /*#__PURE__*/ (0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxDEV)(\"h1\", {\n                className: \"text-2xl font-bold mb-6\",\n                children: \"User Workout Statistics\"\n            }, void 0, false, {\n                fileName: \"/Users/tre/Documents/GitHub/QuickLifts-web/src/pages/user-dashboard.tsx\",\n                lineNumber: 68,\n                columnNumber: 7\n            }, _this),\n            /*#__PURE__*/ (0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxDEV)(\"div\", {\n                className: \"overflow-x-auto\",\n                children: /*#__PURE__*/ (0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxDEV)(\"table\", {\n                    className: \"min-w-full bg-white border border-gray-200\",\n                    children: [\n                        /*#__PURE__*/ (0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxDEV)(\"thead\", {\n                            className: \"bg-gray-50\",\n                            children: /*#__PURE__*/ (0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxDEV)(\"tr\", {\n                                children: [\n                                    /*#__PURE__*/ (0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxDEV)(\"th\", {\n                                        className: \"px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider\",\n                                        children: \"Username\"\n                                    }, void 0, false, {\n                                        fileName: \"/Users/tre/Documents/GitHub/QuickLifts-web/src/pages/user-dashboard.tsx\",\n                                        lineNumber: 73,\n                                        columnNumber: 15\n                                    }, _this),\n                                    /*#__PURE__*/ (0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxDEV)(\"th\", {\n                                        className: \"px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider\",\n                                        children: \"User ID\"\n                                    }, void 0, false, {\n                                        fileName: \"/Users/tre/Documents/GitHub/QuickLifts-web/src/pages/user-dashboard.tsx\",\n                                        lineNumber: 76,\n                                        columnNumber: 15\n                                    }, _this),\n                                    /*#__PURE__*/ (0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxDEV)(\"th\", {\n                                        className: \"px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider\",\n                                        children: \"Total Workouts\"\n                                    }, void 0, false, {\n                                        fileName: \"/Users/tre/Documents/GitHub/QuickLifts-web/src/pages/user-dashboard.tsx\",\n                                        lineNumber: 79,\n                                        columnNumber: 15\n                                    }, _this)\n                                ]\n                            }, void 0, true, {\n                                fileName: \"/Users/tre/Documents/GitHub/QuickLifts-web/src/pages/user-dashboard.tsx\",\n                                lineNumber: 72,\n                                columnNumber: 13\n                            }, _this)\n                        }, void 0, false, {\n                            fileName: \"/Users/tre/Documents/GitHub/QuickLifts-web/src/pages/user-dashboard.tsx\",\n                            lineNumber: 71,\n                            columnNumber: 11\n                        }, _this),\n                        /*#__PURE__*/ (0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxDEV)(\"tbody\", {\n                            className: \"divide-y divide-gray-200\",\n                            children: userStats.map(function(user) {\n                                return /*#__PURE__*/ (0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxDEV)(\"tr\", {\n                                    children: [\n                                        /*#__PURE__*/ (0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxDEV)(\"td\", {\n                                            className: \"px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900\",\n                                            children: user.username\n                                        }, void 0, false, {\n                                            fileName: \"/Users/tre/Documents/GitHub/QuickLifts-web/src/pages/user-dashboard.tsx\",\n                                            lineNumber: 87,\n                                            columnNumber: 17\n                                        }, _this),\n                                        /*#__PURE__*/ (0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxDEV)(\"td\", {\n                                            className: \"px-6 py-4 whitespace-nowrap text-sm text-gray-500\",\n                                            children: user.userId\n                                        }, void 0, false, {\n                                            fileName: \"/Users/tre/Documents/GitHub/QuickLifts-web/src/pages/user-dashboard.tsx\",\n                                            lineNumber: 90,\n                                            columnNumber: 17\n                                        }, _this),\n                                        /*#__PURE__*/ (0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxDEV)(\"td\", {\n                                            className: \"px-6 py-4 whitespace-nowrap text-sm text-gray-500\",\n                                            children: user.workoutCount\n                                        }, void 0, false, {\n                                            fileName: \"/Users/tre/Documents/GitHub/QuickLifts-web/src/pages/user-dashboard.tsx\",\n                                            lineNumber: 93,\n                                            columnNumber: 17\n                                        }, _this)\n                                    ]\n                                }, user.userId, true, {\n                                    fileName: \"/Users/tre/Documents/GitHub/QuickLifts-web/src/pages/user-dashboard.tsx\",\n                                    lineNumber: 86,\n                                    columnNumber: 15\n                                }, _this);\n                            })\n                        }, void 0, false, {\n                            fileName: \"/Users/tre/Documents/GitHub/QuickLifts-web/src/pages/user-dashboard.tsx\",\n                            lineNumber: 84,\n                            columnNumber: 11\n                        }, _this)\n                    ]\n                }, void 0, true, {\n                    fileName: \"/Users/tre/Documents/GitHub/QuickLifts-web/src/pages/user-dashboard.tsx\",\n                    lineNumber: 70,\n                    columnNumber: 9\n                }, _this)\n            }, void 0, false, {\n                fileName: \"/Users/tre/Documents/GitHub/QuickLifts-web/src/pages/user-dashboard.tsx\",\n                lineNumber: 69,\n                columnNumber: 7\n            }, _this)\n        ]\n    }, void 0, true, {\n        fileName: \"/Users/tre/Documents/GitHub/QuickLifts-web/src/pages/user-dashboard.tsx\",\n        lineNumber: 67,\n        columnNumber: 5\n    }, _this);\n};\n_s(UserDashboard, \"/Fav//m/n4SfBxADV/f47RPKi7o=\");\n_c = UserDashboard;\n/* harmony default export */ __webpack_exports__[\"default\"] = (UserDashboard);\nvar _c;\n$RefreshReg$(_c, \"UserDashboard\");\n\n\n;\n    // Wrapped in an IIFE to avoid polluting the global scope\n    ;\n    (function () {\n        var _a, _b;\n        // Legacy CSS implementations will `eval` browser code in a Node.js context\n        // to extract CSS. For backwards compatibility, we need to check we're in a\n        // browser context before continuing.\n        if (typeof self !== 'undefined' &&\n            // AMP / No-JS mode does not inject these helpers:\n            '$RefreshHelpers$' in self) {\n            // @ts-ignore __webpack_module__ is global\n            var currentExports = module.exports;\n            // @ts-ignore __webpack_module__ is global\n            var prevSignature = (_b = (_a = module.hot.data) === null || _a === void 0 ? void 0 : _a.prevSignature) !== null && _b !== void 0 ? _b : null;\n            // This cannot happen in MainTemplate because the exports mismatch between\n            // templating and execution.\n            self.$RefreshHelpers$.registerExportsForReactRefresh(currentExports, module.id);\n            // A module can be accepted automatically based on its exports, e.g. when\n            // it is a Refresh Boundary.\n            if (self.$RefreshHelpers$.isReactRefreshBoundary(currentExports)) {\n                // Save the previous exports signature on update so we can compare the boundary\n                // signatures. We avoid saving exports themselves since it causes memory leaks (https://github.com/vercel/next.js/pull/53797)\n                module.hot.dispose(function (data) {\n                    data.prevSignature =\n                        self.$RefreshHelpers$.getRefreshBoundarySignature(currentExports);\n                });\n                // Unconditionally accept an update to this module, we'll check if it's\n                // still a Refresh Boundary later.\n                // @ts-ignore importMeta is replaced in the loader\n                module.hot.accept();\n                // This field is set when the previous version of this module was a\n                // Refresh Boundary, letting us know we need to check for invalidation or\n                // enqueue an update.\n                if (prevSignature !== null) {\n                    // A boundary can become ineligible if its exports are incompatible\n                    // with the previous exports.\n                    //\n                    // For example, if you add/remove/change exports, we'll want to\n                    // re-execute the importing modules, and force those components to\n                    // re-render. Similarly, if you convert a class component to a\n                    // function, we want to invalidate the boundary.\n                    if (self.$RefreshHelpers$.shouldInvalidateReactRefreshBoundary(prevSignature, self.$RefreshHelpers$.getRefreshBoundarySignature(currentExports))) {\n                        module.hot.invalidate();\n                    }\n                    else {\n                        self.$RefreshHelpers$.scheduleUpdate();\n                    }\n                }\n            }\n            else {\n                // Since we just executed the code for the module, it's possible that the\n                // new exports made it ineligible for being a boundary.\n                // We only care about the case when we were _previously_ a boundary,\n                // because we already accepted this update (accidental side effect).\n                var isNoLongerABoundary = prevSignature !== null;\n                if (isNoLongerABoundary) {\n                    module.hot.invalidate();\n                }\n            }\n        }\n    })();\n//# sourceURL=[module]\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,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S0FBS0csWUFBWTs7Ozs7OzttQ0FSYkgsS0FBS0MsTUFBTTs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQWlCbEM7R0FwR014QjtLQUFBQTtBQXNHTiwrREFBZUEsYUFBYUEsRUFBQyIsInNvdXJjZXMiOlsid2VicGFjazovL19OX0UvLi9zcmMvcGFnZXMvdXNlci1kYXNoYm9hcmQudHN4PzgzNzMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IFJlYWN0LCB7IHVzZVN0YXRlLCB1c2VFZmZlY3QgfSBmcm9tICdyZWFjdCc7XG5cbmNvbnN0IFVzZXJEYXNoYm9hcmQ6IFJlYWN0LkZDID0gKCkgPT4ge1xuICBjb25zdCBbdXNlclN0YXRzLCBzZXRVc2VyU3RhdHNdID0gdXNlU3RhdGU8YW55W10+KFtdKTtcbiAgY29uc3QgW2xvYWRpbmcsIHNldExvYWRpbmddID0gdXNlU3RhdGUodHJ1ZSk7XG4gIGNvbnN0IFtlcnJvciwgc2V0RXJyb3JdID0gdXNlU3RhdGU8c3RyaW5nIHwgbnVsbD4obnVsbCk7XG5cbiAgdXNlRWZmZWN0KCgpID0+IHtcbiAgICBjb25zdCBmZXRjaFdvcmtvdXRTdW1tYXJpZXMgPSBhc3luYyAoKSA9PiB7XG4gICAgICB0cnkge1xuICAgICAgICBzZXRMb2FkaW5nKHRydWUpO1xuICAgICAgICBcbiAgICAgICAgY29uc3QgYXBpVXJsID0gcHJvY2Vzcy5lbnYuTk9ERV9FTlYgPT09ICdkZXZlbG9wbWVudCcgXG4gICAgICAgICAgPyAnaHR0cDovL2xvY2FsaG9zdDo4ODg4Ly5uZXRsaWZ5L2Z1bmN0aW9ucydcbiAgICAgICAgICA6ICdodHRwczovL2ZpdHdpdGhwdWxzZS5haS8ubmV0bGlmeS9mdW5jdGlvbnMnO1xuXG4gICAgICAgIGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgZmV0Y2goYCR7YXBpVXJsfS9nZXQtYWxsLXdvcmtvdXQtc3VtbWFyaWVzYCk7XG4gICAgICAgIFxuICAgICAgICBpZiAoIXJlc3BvbnNlLm9rKSB7XG4gICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdGYWlsZWQgdG8gZmV0Y2ggd29ya291dCBzdW1tYXJpZXMnKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IGRhdGEgPSBhd2FpdCByZXNwb25zZS5qc29uKCk7XG4gICAgICAgIFxuICAgICAgICAvLyBHcm91cCB3b3Jrb3V0cyBieSB1c2VyXG4gICAgICAgIGNvbnN0IHVzZXJXb3Jrb3V0cyA9IGRhdGEuc3VtbWFyaWVzLnJlZHVjZSgoYWNjOiBhbnksIHN1bW1hcnk6IGFueSkgPT4ge1xuICAgICAgICAgIGNvbnN0IHsgdXNlcklkLCB1c2VybmFtZSB9ID0gc3VtbWFyeS51c2VyO1xuICAgICAgICAgIFxuICAgICAgICAgIGlmICghYWNjW3VzZXJJZF0pIHtcbiAgICAgICAgICAgIGFjY1t1c2VySWRdID0ge1xuICAgICAgICAgICAgICB1c2VySWQsXG4gICAgICAgICAgICAgIHVzZXJuYW1lLFxuICAgICAgICAgICAgICB3b3Jrb3V0Q291bnQ6IDBcbiAgICAgICAgICAgIH07XG4gICAgICAgICAgfVxuICAgICAgICAgIFxuICAgICAgICAgIGFjY1t1c2VySWRdLndvcmtvdXRDb3VudCArPSAxO1xuICAgICAgICAgIHJldHVybiBhY2M7XG4gICAgICAgIH0sIHt9KTtcblxuICAgICAgICAvLyBDb252ZXJ0IHRvIGFycmF5IGFuZCBzb3J0IGJ5IHdvcmtvdXQgY291bnRcbiAgICAgICAgY29uc3Qgc3RhdHNBcnJheSA9IE9iamVjdC52YWx1ZXModXNlcldvcmtvdXRzKS5zb3J0KChhOiBhbnksIGI6IGFueSkgPT4gYi53b3Jrb3V0Q291bnQgLSBhLndvcmtvdXRDb3VudCk7XG4gICAgICAgIHNldFVzZXJTdGF0cyhzdGF0c0FycmF5KTtcbiAgICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgICBzZXRFcnJvcihlcnIgaW5zdGFuY2VvZiBFcnJvciA/IGVyci5tZXNzYWdlIDogJ0FuIHVua25vd24gZXJyb3Igb2NjdXJyZWQnKTtcbiAgICAgIH0gZmluYWxseSB7XG4gICAgICAgIHNldExvYWRpbmcoZmFsc2UpO1xuICAgICAgfVxuICAgIH07XG5cbiAgICBmZXRjaFdvcmtvdXRTdW1tYXJpZXMoKTtcbiAgfSwgW10pO1xuXG4gIGlmIChsb2FkaW5nKSB7XG4gICAgcmV0dXJuIDxkaXYgY2xhc3NOYW1lPVwiZmxleCBqdXN0aWZ5LWNlbnRlciBpdGVtcy1jZW50ZXIgaC1zY3JlZW5cIj5Mb2FkaW5nLi4uPC9kaXY+O1xuICB9XG5cbiAgaWYgKGVycm9yKSB7XG4gICAgcmV0dXJuIChcbiAgICAgIDxkaXYgY2xhc3NOYW1lPVwiZmxleCBqdXN0aWZ5LWNlbnRlciBpdGVtcy1jZW50ZXIgaC1zY3JlZW4gdGV4dC1yZWQtNTAwXCI+XG4gICAgICAgIEVycm9yOiB7ZXJyb3J9XG4gICAgICA8L2Rpdj5cbiAgICApO1xuICB9XG5cbiAgcmV0dXJuIChcbiAgICA8ZGl2IGNsYXNzTmFtZT1cInAtNlwiPlxuICAgICAgPGgxIGNsYXNzTmFtZT1cInRleHQtMnhsIGZvbnQtYm9sZCBtYi02XCI+VXNlciBXb3Jrb3V0IFN0YXRpc3RpY3M8L2gxPlxuICAgICAgPGRpdiBjbGFzc05hbWU9XCJvdmVyZmxvdy14LWF1dG9cIj5cbiAgICAgICAgPHRhYmxlIGNsYXNzTmFtZT1cIm1pbi13LWZ1bGwgYmctd2hpdGUgYm9yZGVyIGJvcmRlci1ncmF5LTIwMFwiPlxuICAgICAgICAgIDx0aGVhZCBjbGFzc05hbWU9XCJiZy1ncmF5LTUwXCI+XG4gICAgICAgICAgICA8dHI+XG4gICAgICAgICAgICAgIDx0aCBjbGFzc05hbWU9XCJweC02IHB5LTMgdGV4dC1sZWZ0IHRleHQteHMgZm9udC1tZWRpdW0gdGV4dC1ncmF5LTUwMCB1cHBlcmNhc2UgdHJhY2tpbmctd2lkZXJcIj5cbiAgICAgICAgICAgICAgICBVc2VybmFtZVxuICAgICAgICAgICAgICA8L3RoPlxuICAgICAgICAgICAgICA8dGggY2xhc3NOYW1lPVwicHgtNiBweS0zIHRleHQtbGVmdCB0ZXh0LXhzIGZvbnQtbWVkaXVtIHRleHQtZ3JheS01MDAgdXBwZXJjYXNlIHRyYWNraW5nLXdpZGVyXCI+XG4gICAgICAgICAgICAgICAgVXNlciBJRFxuICAgICAgICAgICAgICA8L3RoPlxuICAgICAgICAgICAgICA8dGggY2xhc3NOYW1lPVwicHgtNiBweS0zIHRleHQtbGVmdCB0ZXh0LXhzIGZvbnQtbWVkaXVtIHRleHQtZ3JheS01MDAgdXBwZXJjYXNlIHRyYWNraW5nLXdpZGVyXCI+XG4gICAgICAgICAgICAgICAgVG90YWwgV29ya291dHNcbiAgICAgICAgICAgICAgPC90aD5cbiAgICAgICAgICAgIDwvdHI+XG4gICAgICAgICAgPC90aGVhZD5cbiAgICAgICAgICA8dGJvZHkgY2xhc3NOYW1lPVwiZGl2aWRlLXkgZGl2aWRlLWdyYXktMjAwXCI+XG4gICAgICAgICAgICB7dXNlclN0YXRzLm1hcCgodXNlcikgPT4gKFxuICAgICAgICAgICAgICA8dHIga2V5PXt1c2VyLnVzZXJJZH0+XG4gICAgICAgICAgICAgICAgPHRkIGNsYXNzTmFtZT1cInB4LTYgcHktNCB3aGl0ZXNwYWNlLW5vd3JhcCB0ZXh0LXNtIGZvbnQtbWVkaXVtIHRleHQtZ3JheS05MDBcIj5cbiAgICAgICAgICAgICAgICAgIHt1c2VyLnVzZXJuYW1lfVxuICAgICAgICAgICAgICAgIDwvdGQ+XG4gICAgICAgICAgICAgICAgPHRkIGNsYXNzTmFtZT1cInB4LTYgcHktNCB3aGl0ZXNwYWNlLW5vd3JhcCB0ZXh0LXNtIHRleHQtZ3JheS01MDBcIj5cbiAgICAgICAgICAgICAgICAgIHt1c2VyLnVzZXJJZH1cbiAgICAgICAgICAgICAgICA8L3RkPlxuICAgICAgICAgICAgICAgIDx0ZCBjbGFzc05hbWU9XCJweC02IHB5LTQgd2hpdGVzcGFjZS1ub3dyYXAgdGV4dC1zbSB0ZXh0LWdyYXktNTAwXCI+XG4gICAgICAgICAgICAgICAgICB7dXNlci53b3Jrb3V0Q291bnR9XG4gICAgICAgICAgICAgICAgPC90ZD5cbiAgICAgICAgICAgICAgPC90cj5cbiAgICAgICAgICAgICkpfVxuICAgICAgICAgIDwvdGJvZHk+XG4gICAgICAgIDwvdGFibGU+XG4gICAgICA8L2Rpdj5cbiAgICA8L2Rpdj5cbiAgKTtcbn07XG5cbmV4cG9ydCBkZWZhdWx0IFVzZXJEYXNoYm9hcmQ7Il0sIm5hbWVzIjpbIlJlYWN0IiwidXNlU3RhdGUiLCJ1c2VFZmZlY3QiLCJVc2VyRGFzaGJvYXJkIiwidXNlclN0YXRzIiwic2V0VXNlclN0YXRzIiwibG9hZGluZyIsInNldExvYWRpbmciLCJlcnJvciIsInNldEVycm9yIiwiZmV0Y2hXb3Jrb3V0U3VtbWFyaWVzIiwiYXBpVXJsIiwicmVzcG9uc2UiLCJkYXRhIiwidXNlcldvcmtvdXRzIiwic3RhdHNBcnJheSIsImVyciIsInByb2Nlc3MiLCJmZXRjaCIsIm9rIiwiRXJyb3IiLCJqc29uIiwic3VtbWFyaWVzIiwicmVkdWNlIiwiYWNjIiwic3VtbWFyeSIsInVzZXIiLCJ1c2VySWQiLCJ1c2VybmFtZSIsIndvcmtvdXRDb3VudCIsIk9iamVjdCIsInZhbHVlcyIsInNvcnQiLCJhIiwiYiIsIm1lc3NhZ2UiLCJkaXYiLCJjbGFzc05hbWUiLCJoMSIsInRhYmxlIiwidGhlYWQiLCJ0ciIsInRoIiwidGJvZHkiLCJtYXAiLCJ0ZCJdLCJzb3VyY2VSb290IjoiIn0=\n//# sourceURL=webpack-internal:///./src/pages/user-dashboard.tsx\n"));

/***/ })

});