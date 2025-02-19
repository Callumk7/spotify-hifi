import { useState, useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { VirtualHiFi } from "../components/VirtualHiFi";
import { SpotifyLogin } from "../components/SpotifyLogin";
import styles from "./index.module.css";

export const Route = createFileRoute("/")({
  component: HomePage,
});

function HomePage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("spotify_access_token");
    setIsAuthenticated(!!token);
  }, []);

  if (!isAuthenticated) {
    return (
      <div className={styles["login-page"]}>
        <h1>Virtual HiFi System</h1>
        <p>Please connect to Spotify to continue</p>
        <SpotifyLogin />
      </div>
    );
  }

  return (
    <div className={styles["home-page"]}>
      <div className={styles["main-content"]}>
        <VirtualHiFi />
      </div>
    </div>
  );
}
