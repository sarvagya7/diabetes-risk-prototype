"use client";

import { useEffect, useState } from "react";

export default function Home() {
  const [status, setStatus] = useState<string>("Checking backend...");

  useEffect(() => {
    fetch("http://127.0.0.1:8000/health")
      .then((res) => res.json())
      .then((data) => setStatus(`Backend says: ${data.status}`))
      .catch((err) => setStatus(`Error reaching backend: ${err.message}`));
  }, []);

  return (
    <main className="flex min-h-screen items-center justify-center">
      <h1 className="text-2xl font-semibold">{status}</h1>
    </main>
  );
}