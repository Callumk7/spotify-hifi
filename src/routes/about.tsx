import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";
import styles from "./about.module.css";

export const Route = createFileRoute("/about")({
  component: AboutComponent,
});

function AboutComponent() {
  return (
    <div className={styles.about}>
      <h1>About Virtual HiFi</h1>

      <section className={styles.section}>
        <h2>The Art of Album Listening</h2>
        <p>
          In today's world of shuffled playlists and algorithmic
          recommendations, we've lost something precious: the art of
          experiencing an album as the artist intended.
        </p>
        <p>
          Albums are more than just collections of songs—they're carefully
          crafted journeys. Each track placement, each transition, and each
          moment of silence is intentional. Artists spend years perfecting not
          just the songs, but their sequence and flow.
        </p>
        <p>
          Virtual HiFi is designed to bring back the ritual of dedicated album
          listening. Like the high-fidelity systems of the past, it encourages
          you to sit down, focus, and experience music as a complete work of
          art—from the opening track to the final note.
        </p>
        <p>By listening to full albums, you'll discover:</p>
        <ul>
          <li>Hidden connections between tracks</li>
          <li>Subtle themes that develop across the album</li>
          <li>Intentional pacing and emotional arcs</li>
          <li>The deeper context of your favorite songs</li>
        </ul>
      </section>
    </div>
  );
}
