import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Lakshya | Plan, Organize, Achieve",
    short_name: "Lakshya",
    description:
      "Company work management platform for projects, Agile tasks, Gantt timelines, personal to-dos, and notes.",
    start_url: "/",
    display: "standalone",
    background_color: "#1B1E24",
    theme_color: "#635BDB",
    icons: [
      {
        src: "/logo-icon.png",
        sizes: "243x243",
        type: "image/png",
      },
    ],
  };
}
