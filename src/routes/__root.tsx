import * as React from "react";
import { Link, Outlet, createRootRoute } from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/router-devtools";
import styles from "./__root.module.css";

export const Route = createRootRoute({
  component: RootComponent,
});

function RootComponent() {
  return (
    <>
      <header className={styles.header}>
        <nav className={styles.nav}>
          <Link
            to="/"
            className={styles.link}
            activeProps={{
              className: `${styles.link} ${styles.active}`,
            }}
            activeOptions={{ exact: true }}
          >
            Virtual HiFi
          </Link>
          <Link
            to="/about"
            className={styles.link}
            activeProps={{
              className: `${styles.link} ${styles.active}`,
            }}
          >
            About
          </Link>
        </nav>
      </header>
      <main className={styles.main}>
        <Outlet />
      </main>
      <TanStackRouterDevtools position="bottom-right" />
    </>
  );
}
