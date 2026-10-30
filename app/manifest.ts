import { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "M Routine - Daily Tracker",
    short_name: "M Routine",
    description: "High performance daily checklist, diet, weekly and future reminders",
    start_url: "/today",
    display: "standalone",
    background_color: "#08080A",
    theme_color: "#08080A",
    icons: [
      {
        src: "/icons/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
      },
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
