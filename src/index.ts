import { defaultReporter } from '@web/test-runner';
import fs from 'fs';
import { createRequire } from 'module';
import { pathToFileURL } from 'url';
const require = createRequire(import.meta.url);
const jasminePath = pathToFileURL(require.resolve('jasmine-core/lib/jasmine-core/jasmine.js'));

export const jasmineTestRunnerConfig = () => {
  return {
    reporters: [
      defaultReporter({ reportTestResults: true, reportTestProgress: true })
    ],
    testRunnerHtml: (_path: any, config: { testFramework: { config?: { timeout?: number, styles?: [] }}}) => {
      const testFramework = {
        path: './node_modules/jasmine-core/lib/jasmine-core/jasmine.js',
        config: {
          timeout: 20000,
          styles: [],
          ...config.testFramework?.config
        }
      };
      return /* html */`
        <html>
          <head>
            ${testFramework.config.styles.map(style => `<link href="${style}" rel="stylesheet" />`)}
            <script>window.process = { env: { NODE_ENV: "development" } }</script>
            <script>${fs.readFileSync(jasminePath, 'utf8')}</script>
            <script type="module">
              import { getConfig, sessionStarted, sessionFinished, sessionFailed } from '@web/test-runner-core/browser/session.js';
   
              const testFramework = {
                ...${JSON.stringify(testFramework)}
              };
  
              const jasmine = jasmineRequire.core(window.jasmineRequire);
              jasmine.DEFAULT_TIMEOUT_INTERVAL = testFramework.config.timeout;
              const global = jasmine.getGlobal();
              global.jasmine = jasmine;
              const env = jasmine.getEnv();
              Object.assign(window, jasmineRequire.interface(jasmine, env));
              window.onload = function () {};
  
              const failedSpecs = [];
              const allSpecs = [];
              const failedImports = [];
  
              env.addReporter({
                jasmineStarted: () => {},
                suiteStarted: () => {},
                specStarted: () => {},
                suiteDone: () => {},
                specDone: result => {
                  [...result.passedExpectations, ...result.failedExpectations].forEach(e => {
                    allSpecs.push({
                      name: e.description,
                      passed: e.passed,
                    });
                  });
  
                  if (result.status !== 'passed' || result.status !== 'incomplete') {
                    result.failedExpectations.forEach(e => {
                      failedSpecs.push({
                        message: result.description + ': ' + e.message,
                        name: e.description,
                        stack: e.stack,
                        expected: e.expected,
                        actual: e.actual,
                      });
                    });
                  }
                },
                jasmineDone: result => {
                  sessionFinished({
                    passed: result.overallStatus === 'passed',
                    errors: [...failedSpecs, ...failedImports],
                    testResults: {
                      name: '',
                      suites: [],
                      tests: allSpecs,
                    },
                  });
                },
              });
  
              (async () => {
                sessionStarted();
                const { testFile, watch, debug, testFrameworkConfig } = await getConfig();
                const config = { defaultTimeoutInterval: 60000, ...(testFrameworkConfig ?? {}) };
  
                jasmine.DEFAULT_TIMEOUT_INTERVAL = config.defaultTimeoutInterval;
  
                await import(new URL(testFile, document.baseURI).href).catch(error => {
                  failedImports.push({ file: testFile, error: { message: error.message, stack: error.stack } });
                });
  
                try {
                  env.execute();
                } catch (error) {
                  console.log(error);
                  sessionFailed(error);
                  return;
                }
              })();
            </script>
          </head>
          <body></body>
        </html>
      `;
    }
  }
}