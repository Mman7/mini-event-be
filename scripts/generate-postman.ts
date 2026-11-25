import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

type OpenApiDocument = {
  info: { title: string; version: string };
  paths: Record<string, Record<string, OpenApiOperation>>;
  components?: {
    parameters?: Record<string, OpenApiParameter>;
  };
};

type OpenApiParameter = {
  name: string;
  in: "path" | "query" | "header";
  required?: boolean;
  example?: string | number;
  schema?: { example?: string | number };
};

type OpenApiOperation = {
  summary?: string;
  parameters?: Array<OpenApiParameter | { $ref: string }>;
  requestBody?: {
    content?: {
      "application/json"?: { example?: Record<string, unknown> };
    };
  };
};

type PostmanItem = {
  name: string;
  request: {
    method: string;
    header?: Array<{ key: string; value: string; type: string }>;
    body?: { mode: "raw"; raw: string; options: { raw: { language: "json" } } };
    url: {
      raw: string;
      host: [string];
      path: string[];
      variable?: Array<{ key: string; value: string; type: "string" }>;
      query?: Array<{ key: string; value: string; disabled?: boolean }>;
    };
    description?: string;
  };
};

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const openApiPath = resolve(projectRoot, "docs/openapi.json");
const collectionPath = resolve(projectRoot, "postman/collection.json");
const specification = JSON.parse(
  await readFile(openApiPath, "utf8"),
) as OpenApiDocument;

function pathSegments(path: string) {
  return path
    .split("/")
    .filter(Boolean)
    .map((segment) =>
      segment.startsWith("{") ? `:${segment.slice(1, -1)}` : segment,
    );
}

function createItem(
  path: string,
  method: string,
  operation: OpenApiOperation,
): PostmanItem {
  const parameters = (operation.parameters ?? []).map((parameter) => {
    if ("$ref" in parameter) {
      const parameterName = parameter.$ref.split("/").pop() ?? "";
      const resolved = specification.components?.parameters?.[parameterName];
      if (!resolved) {
        throw new Error(
          `Unable to resolve OpenAPI parameter: ${parameter.$ref}`,
        );
      }
      return resolved;
    }
    return parameter;
  });
  const pathVariables = parameters.filter(
    (parameter) => parameter.in === "path",
  );
  const queryParameters = parameters.filter(
    (parameter) => parameter.in === "query",
  );
  const headerParameters = parameters.filter(
    (parameter) => parameter.in === "header",
  );
  const request: PostmanItem["request"] = {
    method: method.toUpperCase(),
    header: [],
    url: {
      raw: `{{base_url}}${path}`,
      host: ["{{base_url}}"],
      path: pathSegments(path),
    },
  };

  if (headerParameters.length > 0) {
    request.header = headerParameters.map((parameter) => ({
      key: parameter.name,
      value: String(parameter.example ?? parameter.schema?.example ?? ""),
      type: "text",
    }));
  }

  if (pathVariables.length > 0) {
    request.url.variable = pathVariables.map((parameter) => ({
      key: parameter.name,
      value: String(parameter.example ?? "1"),
      type: "string",
    }));
  }

  if (queryParameters.length > 0) {
    request.url.query = queryParameters.map((parameter) => ({
      key: parameter.name,
      value: String(parameter.example ?? ""),
      disabled: true,
    }));
  }

  const example = operation.requestBody?.content?.["application/json"]?.example;
  if (example) {
    request.header = [
      ...(request.header ?? []),
      { key: "Content-Type", value: "application/json", type: "text" },
    ];
    request.body = {
      mode: "raw",
      raw: JSON.stringify(example, null, 2),
      options: { raw: { language: "json" } },
    };
  }

  if (operation.summary) {
    request.description = operation.summary;
  }

  return {
    name: operation.summary ?? `${method.toUpperCase()} ${path}`,
    request,
  };
}

const items: PostmanItem[] = [];
for (const [path, pathItem] of Object.entries(specification.paths)) {
  for (const [method, operation] of Object.entries(pathItem)) {
    if (["get", "post", "put", "patch", "delete"].includes(method)) {
      items.push(createItem(path, method, operation));
    }
  }
}

const collection = {
  info: {
    name: specification.info.title,
    description:
      "Generated from docs/openapi.json. Run npm run postman:generate after changing the OpenAPI document.",
    schema:
      "https://schema.getpostman.com/json/collection/v2.1.0/collection.json",
  },
  variable: [
    { key: "base_url", value: "http://localhost:5000", type: "string" },
  ],
  item: items,
};

await mkdir(dirname(collectionPath), { recursive: true });
await writeFile(
  collectionPath,
  `${JSON.stringify(collection, null, 2)}\n`,
  "utf8",
);
console.log(`Generated ${collectionPath}`);
