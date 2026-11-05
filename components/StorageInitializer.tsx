"use client";

import { useEffect } from "react";
import { requestStoragePersistence } from "@/lib/storage";

export default function StorageInitializer() {
  useEffect(() => {
    requestStoragePersistence();
  }, []);

  return null;
}

