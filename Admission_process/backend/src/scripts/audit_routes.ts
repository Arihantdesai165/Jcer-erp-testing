import adminRoutes from '../routes/admin.routes';
import admissionRoutes from '../routes/admission.routes';
import authRoutes from '../routes/auth.routes';
import deanRoutes from '../routes/dean.routes';
import hodRoutes from '../routes/hod.routes';
import principalRoutes from '../routes/principal.routes';
import promotionRoutes from '../routes/promotion.routes';
import provisionalRoutes from '../routes/provisional.routes';
import systemRoutes from '../routes/system.routes';

const routers: Record<string, any> = {
  adminRoutes,
  admissionRoutes,
  authRoutes,
  deanRoutes,
  hodRoutes,
  principalRoutes,
  promotionRoutes,
  provisionalRoutes,
  systemRoutes,
};

let missingCount = 0;
const registeredRoutes: { routerName: string; method: string; path: string; hasHandler: boolean }[] = [];

for (const [routerName, router] of Object.entries(routers)) {
  if (!router || !router.stack) continue;
  router.stack.forEach((layer: any) => {
    if (layer.route) {
      const methods = Object.keys(layer.route.methods).map(m => m.toUpperCase()).join(',');
      const path = layer.route.path;
      layer.route.stack.forEach((s: any) => {
        const isDefined = typeof s.handle === 'function' && s.handle.name !== 'undefined';
        registeredRoutes.push({ routerName, method: methods, path, hasHandler: isDefined });
        if (!isDefined || s.handle === undefined) {
          console.error(`[UNDEFINED ROUTE HANDLER] Router: ${routerName} | Method: ${methods} | Path: ${path}`);
          missingCount++;
        }
      });
    }
  });
}

console.log(`\n[ROUTE AUDIT SUMMARY] Total Routes Scanned: ${registeredRoutes.length} | Missing Handlers: ${missingCount}`);
process.exit(0);
