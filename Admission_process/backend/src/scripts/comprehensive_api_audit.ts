import fs from 'fs';
import path from 'path';
import app from '../app';

interface FrontendCall {
  file: string;
  line: number;
  method: string;
  rawUrl: string;
  normalizedUrl: string;
}

interface BackendRoute {
  method: string;
  path: string;
  regex: RegExp;
  handlerName: string;
}

// 1. Collect all backend routes from Express app
function extractBackendRoutes(): BackendRoute[] {
  const routes: BackendRoute[] = [];

  function processStack(stack: any[], prefix: string = '') {
    for (const layer of stack) {
      if (layer.route) {
        const routePath = prefix + layer.route.path;
        const methods = Object.keys(layer.route.methods);
        for (const m of methods) {
          const handler = layer.route.stack[layer.route.stack.length - 1];
          const handlerName = handler?.name || 'anonymous';
          
          // Convert routePath to regex (e.g. /api/hod/students/:id -> /api/hod/students/[^/]+)
          const cleanPath = routePath.replace(/\/+/g, '/').replace(/\/$/, '') || '/';
          const regexStr = '^' + cleanPath
            .replace(/\/:[a-zA-Z0-9_]+/g, '/[^/]+')
            .replace(/\/\*/g, '/.*') + '$';

          routes.push({
            method: m.toUpperCase(),
            path: cleanPath,
            regex: new RegExp(regexStr, 'i'),
            handlerName,
          });
        }
      } else if (layer.name === 'router' && layer.handle?.stack) {
        let routerPrefix = prefix;
        if (layer.regexp) {
          // Extract prefix from layer regexp if available
          const match = layer.regexp.source
            .replace('\\/?(?=\\/|$)', '')
            .replace('^\\/', '/')
            .replace('^', '')
            .replace('\\/', '/')
            .replace('(?:\\/(?=$))?$', '');
          
          // Clean common express regexp patterns
          let p = match;
          p = p.replace(/\\\//g, '/').replace(/\/\?\(\?=\\\/\|\$\)/g, '').replace(/\?\(\?=\/\|\$\)/g, '');
          p = p.replace(/\^/g, '').replace(/\$/g, '');
          p = p.replace(/\(\?:\/\|\$\)/g, '');
          p = p.replace(/\(\?:\/\|\$\)/g, '');
          
          if (p && !p.includes('.*')) {
            routerPrefix = (prefix + '/' + p).replace(/\/+/g, '/');
          }
        }
        processStack(layer.handle.stack, routerPrefix);
      }
    }
  }

  // Explore top-level app stack
  if ((app as any)._router?.stack) {
    processStack((app as any)._router.stack);
  }

  return routes;
}

// 2. Scan frontend files for API calls
function scanFrontendFiles(dir: string, fileList: string[] = []): string[] {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      if (!file.includes('node_modules') && !file.includes('.git') && !file.includes('dist')) {
        scanFrontendFiles(fullPath, fileList);
      }
    } else if (/\.(ts|tsx|js|jsx)$/.test(file)) {
      fileList.push(fullPath);
    }
  }
  return fileList;
}

function extractFrontendCalls(files: string[]): FrontendCall[] {
  const calls: FrontendCall[] = [];
  // Regex to match API.get, api.post, axios.delete, fetch, etc.
  const apiRegex = /(?:API|api|axios|authAxios)\s*\.\s*(get|post|put|patch|delete)\s*(?:<[^>]+>)?\s*\(\s*([`'"][^`'"]+[`'"])/g;
  const fetchRegex = /fetch\s*\(\s*([`'"][^`'"]+[`'"])/g;

  for (const filePath of files) {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');

    lines.forEach((line, idx) => {
      let match: RegExpExecArray | null;
      while ((match = apiRegex.exec(line)) !== null) {
        const method = match[1].toUpperCase();
        let rawUrl = match[2].slice(1, -1); // strip quotes

        // Normalize URL
        let normUrl = rawUrl;
        if (!normUrl.startsWith('/api') && !normUrl.startsWith('http')) {
          normUrl = '/api/' + normUrl.replace(/^\/+/, '');
        } else if (normUrl.startsWith('http')) {
          try {
            normUrl = new URL(normUrl).pathname;
          } catch {}
        }

        // Replace template placeholders like ${id} or ${semester} with placeholder
        normUrl = normUrl.replace(/\$\{[^}]+\}/g, 'PARAM_VAL');
        normUrl = normUrl.split('?')[0]; // remove query string
        normUrl = normUrl.replace(/\/+/g, '/').replace(/\/$/, '') || '/';

        calls.push({
          file: path.relative(process.cwd(), filePath),
          line: idx + 1,
          method,
          rawUrl,
          normalizedUrl: normUrl,
        });
      }
    });
  }

  return calls;
}

async function runAudit() {
  console.log('--- SCANNING BACKEND ROUTES ---');
  const backendRoutes = extractBackendRoutes();
  console.log(`Discovered ${backendRoutes.length} registered backend routes.`);

  console.log('\n--- SCANNING FRONTEND API CALLS ---');
  const frontendDir = path.resolve(__dirname, '../../../frontend/src');
  console.log(`Scanning frontend directory: ${frontendDir}`);
  const frontendFiles = scanFrontendFiles(frontendDir);
  const frontendCalls = extractFrontendCalls(frontendFiles);
  console.log(`Discovered ${frontendCalls.length} frontend API invocations across ${frontendFiles.length} files.`);

  // Verify each frontend call against backend routes
  const missingRoutes: FrontendCall[] = [];
  const methodMismatches: { call: FrontendCall; expectedMethods: string[] }[] = [];
  const matchedCalls: { call: FrontendCall; backendRoute: BackendRoute }[] = [];

  for (const call of frontendCalls) {
    // Test matches
    const pathMatches = backendRoutes.filter(br => {
      // Test regex against normalizedUrl (replacing PARAM_VAL with sample id)
      const testPath = call.normalizedUrl.replace(/PARAM_VAL/g, 'any_id_123');
      return br.regex.test(testPath) || br.path === call.normalizedUrl;
    });

    if (pathMatches.length === 0) {
      missingRoutes.push(call);
    } else {
      const exactMethodMatch = pathMatches.find(br => br.method === call.method);
      if (exactMethodMatch) {
        matchedCalls.push({ call, backendRoute: exactMethodMatch });
      } else {
        methodMismatches.push({
          call,
          expectedMethods: pathMatches.map(p => p.method),
        });
      }
    }
  }

  console.log('\n==================================================');
  console.log('AUDIT SUMMARY');
  console.log('==================================================');
  console.log(`Matched Calls:      ${matchedCalls.length}`);
  console.log(`Method Mismatches:  ${methodMismatches.length}`);
  console.log(`Missing Endpoints:  ${missingRoutes.length}`);

  if (methodMismatches.length > 0) {
    console.log('\n[METHOD MISMATCHES]');
    methodMismatches.forEach(({ call, expectedMethods }) => {
      console.log(`  File: ${call.file}:${call.line}`);
      console.log(`  Frontend calls: [${call.method}] ${call.rawUrl}`);
      console.log(`  Backend expects: [${expectedMethods.join(', ')}]\n`);
    });
  }

  if (missingRoutes.length > 0) {
    console.log('\n[POTENTIALLY MISSING BACKEND ENDPOINTS]');
    // Group unique missing routes
    const uniqueMissing = new Map<string, FrontendCall>();
    missingRoutes.forEach(m => {
      const key = `[${m.method}] ${m.normalizedUrl}`;
      if (!uniqueMissing.has(key)) uniqueMissing.set(key, m);
    });

    uniqueMissing.forEach((call, key) => {
      console.log(`  ${key}`);
      console.log(`    File: ${call.file}:${call.line} (${call.rawUrl})`);
    });
  }

  const hasErrors = missingRoutes.length > 0 || methodMismatches.length > 0;
  if (hasErrors) {
    console.error('\n❌ ROUTE CONTRACT AUDIT FAILED: Missing endpoints or method mismatches detected.');
    process.exit(1);
  } else {
    console.log('\n✅ ROUTE CONTRACT AUDIT PASSED: 0 broken contracts detected across all frontend API invocations.');
    process.exit(0);
  }
}

runAudit();
