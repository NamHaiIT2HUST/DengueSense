/**
 * Luật kiến trúc dashboard (docs/10 §5.2) — CI chặn nếu vi phạm:  npm run depcruise
 *
 *   app  →  features  →  entities  →  shared        (chỉ được import XUỐNG)
 *
 * Mỗi rule có `comment` nêu vì sao; đừng nới lỏng để "cho qua" — sửa ranh giới hoặc viết ADR.
 */
/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: "no-circular",
      severity: "error",
      comment: "Vòng phụ thuộc làm khó hiểu, khó tách chunk và dễ gây lỗi khởi tạo module.",
      from: {},
      to: { circular: true },
    },
    {
      name: "shared-is-bottom-layer",
      severity: "error",
      comment: "shared/ không được biết gì về nghiệp vụ: không import entities/, features/, app/.",
      from: { path: "^src/shared/" },
      to: { path: "^src/(entities|features|app)/" },
    },
    {
      name: "entities-below-features",
      severity: "error",
      comment: "entities/ không được import features/ hoặc app/ (chỉ được import xuống shared/).",
      from: { path: "^src/entities/" },
      to: { path: "^src/(features|app)/" },
    },
    {
      name: "features-below-app",
      severity: "error",
      comment: "features/ không được import app/ (app là tầng ghép: router, providers).",
      from: { path: "^src/features/" },
      to: { path: "^src/app/" },
    },
    {
      name: "no-feature-to-feature",
      severity: "error",
      comment:
        "features/A không import features/B. Cần dùng chung → đẩy xuống entities/ hoặc shared/, hoặc ghép ở tầng route.",
      from: { path: "^src/features/([^/]+)/" },
      to: { path: "^src/features/([^/]+)/", pathNot: "^src/features/$1/" },
    },
    {
      name: "no-deep-import-from-outside",
      severity: "error",
      comment:
        "Bên ngoài một feature/entity chỉ được import qua index.ts của nó (cổng công khai), không import sâu vào file bên trong.",
      from: { path: "^src/", pathNot: "^src/(features|entities)/" },
      to: {
        path: "^src/(features|entities)/[^/]+/.+",
        pathNot: "^src/(features|entities)/[^/]+/index\\.tsx?$",
      },
    },
    {
      name: "no-deep-import-across-modules",
      severity: "error",
      comment: "Giữa các module features/entities cũng chỉ import qua index.ts (không import sâu).",
      from: { path: "^src/(features|entities)/([^/]+)/" },
      to: {
        path: "^src/(features|entities)/([^/]+)/.+",
        pathNot: ["^src/$1/$2/", "^src/(features|entities)/[^/]+/index\\.tsx?$"],
      },
    },
    {
      name: "schema-gen-only-in-api-and-entities",
      severity: "error",
      comment:
        "schema.gen.ts (sinh từ hợp đồng) chỉ được import trong shared/api và entities/. Nơi khác lấy kiểu từ '@/shared/api' — đổi hợp đồng chỉ phải sửa một chỗ.",
      from: { pathNot: "^src/(shared/api|entities)/" },
      to: { path: "schema\\.gen\\.ts$" },
    },
    {
      name: "no-test-code-in-production",
      severity: "error",
      comment: "Mã production không được import mocks/, test/ hoặc file *.test.*.",
      from: { pathNot: "(\\.test\\.tsx?$|^src/(mocks|test)/)" },
      to: { path: "(\\.test\\.tsx?$|^src/(mocks|test)/)" },
    },
    {
      name: "no-orphans",
      severity: "error",
      comment: "File không ai import và không phải điểm vào là mã chết.",
      from: {
        orphan: true,
        pathNot: [
          "\\.d\\.ts$",
          "\\.test\\.tsx?$",
          "^src/test/",
          "^src/mocks/",
          "^src/app/main\\.tsx$",
          "^src/app/routeTree\\.gen\\.ts$",
          "^src/app/routes/",
        ],
      },
      to: {},
    },
  ],
  options: {
    doNotFollow: { path: "node_modules" },
    tsConfig: { fileName: "tsconfig.app.json" },
    tsPreCompilationDeps: true,
    enhancedResolveOptions: {
      exportsFields: ["exports"],
      conditionNames: ["import", "require", "node", "default", "types"],
      mainFields: ["module", "main", "types", "typings"],
    },
    includeOnly: "^src",
  },
};
