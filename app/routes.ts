import {
  type RouteConfig,
  index,
  layout,
  route,
} from "@react-router/dev/routes";

export default [
  layout("routes/dashboard.tsx", [
    index("routes/entries.tsx"),
    route("tags", "routes/tags.tsx"),
  ]),
] satisfies RouteConfig;
