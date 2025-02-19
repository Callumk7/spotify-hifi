import { useState, useEffect } from "react";
import type { FC } from "react";
import {
  play,
  pause,
  setVolume as setSpotifyVolume,
  seek,
  initializePlayer,
  getCurrentPlaybackState,
  logout,
} from "../services/spotify";
import { SpotifySearch } from "./SpotifySearch";
import styles from "./VirtualHiFi.module.css";

interface CD {
  id: string;
  albumName: string;
  artistName: string;
  tracks: SpotifyTrack[];
  imageUrl: string;
}

interface SpotifyTrack {
  id: string;
  name: string;
  duration_ms: number;
}

const STORAGE_KEY = "virtualHiFi_loadedCDs";

export const VirtualHiFi: FC = () => {
  const [loadedCDs, setLoadedCDs] = useState<(CD | null)[]>(() => {
    const savedCDs = localStorage.getItem(STORAGE_KEY);
    return savedCDs ? JSON.parse(savedCDs) : new Array(12).fill(null);
  });
  const [currentCDIndex, setCurrentCDIndex] = useState<number>(0);
  const [currentTrackIndex, setCurrentTrackIndex] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(() => {
    const savedVolume = localStorage.getItem("spotify_volume");
    return savedVolume ? Number(savedVolume) : 50;
  });
  const [showSearch, setShowSearch] = useState(false);
  const [playbackPosition, setPlaybackPosition] = useState(0);
  const [isInitialized, setIsInitialized] = useState(false);
  const [_initError, setInitError] = useState<string | null>(null);
  const [playbackState, setPlaybackState] =
    useState<Spotify.PlaybackState | null>(null);

  const currentCD = loadedCDs[currentCDIndex];
  const currentTrack = currentCD?.tracks[currentTrackIndex];

  // Initialize Spotify Web Playback SDK
  useEffect(() => {
    let mounted = true;

    const initialize = async () => {
      // Don't initialize if we're already initialized
      if (isInitialized) {
        return;
      }

      console.log("Initializing player...");
      try {
        await initializePlayer();

        if (!mounted) return;

        console.log("Player initialization completed");
        setIsInitialized(true);
        setInitError(null);
      } catch (error) {
        console.error("Failed to initialize player:", error);
        if (mounted) {
          setInitError(
            error instanceof Error
              ? error.message
              : "Failed to initialize player"
          );
          setIsInitialized(false);
        }
      }
    };

    initialize();

    // Cleanup function
    return () => {
      mounted = false;
    };
  }, [isInitialized]); // Add isInitialized to dependencies

  // Update playback state
  useEffect(() => {
    let intervalId: number;

    if (isPlaying) {
      console.log("Starting playback state polling");
      intervalId = window.setInterval(async () => {
        const state = await getCurrentPlaybackState();
        if (state) {
          console.log("Received playback state update:", {
            position: state.position,
            duration: state.duration,
            track: state.track_window?.current_track?.name,
          });
          setPlaybackState(state);
          setPlaybackPosition(state.position);

          // Check if we've reached the end of the track
          if (
            state.position === 0 &&
            state.paused &&
            currentCD &&
            currentTrackIndex === currentCD.tracks.length - 1
          ) {
            console.log("End of album reached, attempting to play next album");
            nextCD();
          } else if (state.position === 0 && state.paused && currentCD) {
            console.log("Track finished, playing next track");
            nextTrack();
          }
        } else {
          console.warn("No playback state received");
        }
      }, 1000);
    }

    return () => {
      if (intervalId) {
        console.log("Stopping playback state polling");
        window.clearInterval(intervalId);
      }
    };
  }, [isPlaying, currentCD, currentTrackIndex]); // Add currentCD and currentTrackIndex to dependencies

  // Save CDs to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(loadedCDs));
  }, [loadedCDs]);

  const togglePlayPause = async () => {
    if (!currentCD || !isInitialized || !currentTrack) {
      console.warn("Cannot toggle playback:", {
        hasCD: !!currentCD,
        isInitialized,
        hasTrack: !!currentTrack,
      });
      return;
    }

    try {
      if (isPlaying) {
        console.log("Pausing playback");
        await pause();
        setIsPlaying(false);
      } else {
        console.log("Starting playback of track:", {
          id: currentTrack.id,
          name: currentTrack.name,
        });
        await play(currentTrack.id);
        setIsPlaying(true);
      }
    } catch (error) {
      console.error("Playback error:", error);
      setIsPlaying(false);
      if (error instanceof Error) {
        setInitError(error.message);
      }
    }
  };

  const handleAlbumSelect = (album: CD) => {
    console.log("Loading album:", {
      id: album.id,
      name: album.albumName,
      trackCount: album.tracks.length,
    });
    const newLoadedCDs = [...loadedCDs];
    newLoadedCDs[currentCDIndex] = album;
    setLoadedCDs(newLoadedCDs);
    setShowSearch(false);
    setCurrentTrackIndex(0);
    setPlaybackPosition(0);
    setIsPlaying(false);
  };

  const handleRemoveCD = (index: number, event: React.MouseEvent) => {
    event.stopPropagation(); // Prevent triggering the slot click
    const newLoadedCDs = [...loadedCDs];
    newLoadedCDs[index] = null;
    setLoadedCDs(newLoadedCDs);

    // If we're removing the current CD, stop playback
    if (index === currentCDIndex) {
      setIsPlaying(false);
      setCurrentTrackIndex(0);
      setPlaybackPosition(0);
    }
  };

  const nextTrack = async () => {
    if (!currentCD) {
      console.warn("Cannot play next track: no CD loaded");
      return;
    }

    // If we're not at the end of the current CD
    if (currentTrackIndex < currentCD.tracks.length - 1) {
      const nextTrackId = currentCD.tracks[currentTrackIndex + 1].id;
      console.log("Playing next track on current CD:", {
        currentIndex: currentTrackIndex,
        nextTrackId,
        trackName: currentCD.tracks[currentTrackIndex + 1].name,
      });
      try {
        await play(nextTrackId);
        setCurrentTrackIndex((prev) => prev + 1);
        setPlaybackPosition(0);
        if (!isPlaying) setIsPlaying(true);
      } catch (error) {
        console.error("Failed to play next track:", error);
      }
    } else {
      // We're at the end of the current CD, try to play the next CD
      let nextCDIndex = (currentCDIndex + 1) % 12;
      const nextCD = loadedCDs[nextCDIndex];

      // Find the next available CD
      while (!nextCD && nextCDIndex !== currentCDIndex) {
        nextCDIndex = (nextCDIndex + 1) % 12;
        if (loadedCDs[nextCDIndex]) break;
      }

      if (loadedCDs[nextCDIndex] && nextCDIndex !== currentCDIndex) {
        console.log("Moving to next CD:", {
          fromCD: currentCDIndex,
          toCD: nextCDIndex,
        });
        const nextCDTracks = loadedCDs[nextCDIndex]?.tracks;
        if (!nextCDTracks?.[0]?.id) {
          console.error("Next CD tracks are invalid");
          return;
        }
        setCurrentCDIndex(nextCDIndex);
        setCurrentTrackIndex(0);
        setPlaybackPosition(0);
        try {
          await play(nextCDTracks[0].id);
          if (!isPlaying) setIsPlaying(true);
        } catch (error) {
          console.error("Failed to start next CD:", error);
        }
      } else {
        console.log("No more CDs available to play");
      }
    }
  };

  const previousTrack = async () => {
    if (!currentCD) {
      console.warn("Cannot play previous track: no CD loaded");
      return;
    }

    // If we're not at the start of the current CD
    if (currentTrackIndex > 0) {
      const prevTrackId = currentCD.tracks[currentTrackIndex - 1].id;
      console.log("Playing previous track on current CD:", {
        currentIndex: currentTrackIndex,
        prevTrackId,
        trackName: currentCD.tracks[currentTrackIndex - 1].name,
      });
      try {
        await play(prevTrackId);
        setCurrentTrackIndex((prev) => prev - 1);
        setPlaybackPosition(0);
        if (!isPlaying) setIsPlaying(true);
      } catch (error) {
        console.error("Failed to play previous track:", error);
      }
    } else {
      // We're at the start of the current CD, try to play the previous CD
      let prevCDIndex = (currentCDIndex - 1 + 12) % 12;
      const prevCD = loadedCDs[prevCDIndex];

      // Find the previous available CD
      while (!prevCD && prevCDIndex !== currentCDIndex) {
        prevCDIndex = (prevCDIndex - 1 + 12) % 12;
        if (loadedCDs[prevCDIndex]) break;
      }

      if (loadedCDs[prevCDIndex] && prevCDIndex !== currentCDIndex) {
        const prevCD = loadedCDs[prevCDIndex];
        if (!prevCD?.tracks?.length) {
          console.error("Previous CD tracks are invalid");
          return;
        }
        const lastTrackIndex = prevCD.tracks.length - 1;
        console.log("Moving to previous CD:", {
          fromCD: currentCDIndex,
          toCD: prevCDIndex,
          toTrack: lastTrackIndex,
        });
        setCurrentCDIndex(prevCDIndex);
        setCurrentTrackIndex(lastTrackIndex);
        setPlaybackPosition(0);
        try {
          await play(prevCD.tracks[lastTrackIndex].id);
          if (!isPlaying) setIsPlaying(true);
        } catch (error) {
          console.error("Failed to start previous CD:", error);
        }
      } else {
        console.log("No previous CDs available to play");
      }
    }
  };

  const nextCD = async () => {
    let nextCDIndex = (currentCDIndex + 1) % 12;
    const nextCD = loadedCDs[nextCDIndex];

    // Find the next available CD
    while (!nextCD && nextCDIndex !== currentCDIndex) {
      nextCDIndex = (nextCDIndex + 1) % 12;
      if (loadedCDs[nextCDIndex]) break;
    }

    if (loadedCDs[nextCDIndex] && nextCDIndex !== currentCDIndex) {
      console.log("Switching to next CD:", {
        fromCD: currentCDIndex,
        toCD: nextCDIndex,
      });
      const nextCDTracks = loadedCDs[nextCDIndex]?.tracks;
      if (!nextCDTracks?.[0]?.id) {
        console.error("Next CD tracks are invalid");
        return;
      }
      setCurrentCDIndex(nextCDIndex);
      setCurrentTrackIndex(0);
      setPlaybackPosition(0);
      try {
        await play(nextCDTracks[0].id);
        setIsPlaying(true);
      } catch (error) {
        console.error("Failed to start next CD:", error);
      }
    }
  };

  const previousCD = async () => {
    let prevCDIndex = (currentCDIndex - 1 + 12) % 12;
    const prevCD = loadedCDs[prevCDIndex];

    // Find the previous available CD
    while (!prevCD && prevCDIndex !== currentCDIndex) {
      prevCDIndex = (prevCDIndex - 1 + 12) % 12;
      if (loadedCDs[prevCDIndex]) break;
    }

    if (loadedCDs[prevCDIndex] && prevCDIndex !== currentCDIndex) {
      console.log("Switching to previous CD:", {
        fromCD: currentCDIndex,
        toCD: prevCDIndex,
      });
      const prevCDTracks = loadedCDs[prevCDIndex]?.tracks;
      if (!prevCDTracks?.[0]?.id) {
        console.error("Previous CD tracks are invalid");
        return;
      }
      setCurrentCDIndex(prevCDIndex);
      setCurrentTrackIndex(0);
      setPlaybackPosition(0);
      try {
        await play(prevCDTracks[0].id);
        setIsPlaying(true);
      } catch (error) {
        console.error("Failed to start previous CD:", error);
      }
    }
  };

  const handleVolumeChange = async (newVolume: number) => {
    console.log("Changing volume to:", newVolume);
    setVolume(newVolume);
    try {
      await setSpotifyVolume(newVolume);
    } catch (error) {
      console.error("Failed to change volume:", error);
    }
  };

  const handleSeek = async (newPosition: number) => {
    console.log("Seeking to position:", newPosition);
    setPlaybackPosition(newPosition);
    await seek(newPosition);
  };

  const formatTime = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
  };

  const handleSlotClick = (index: number) => {
    if (loadedCDs[index]) {
      setCurrentCDIndex(index);
    } else {
      setCurrentCDIndex(index);
      setShowSearch(true);
    }
  };

  return (
    <div className={styles["virtual-hifi"]}>
      <div className={styles["cd-rack"]}>
        {loadedCDs.map((cd, index) => (
          <button
            key={`slot-${index}-${cd?.id ?? "empty"}`}
            className={`${styles["cd-slot"]} ${
              index === currentCDIndex ? styles.active : ""
            }`}
            onClick={() => handleSlotClick(index)}
            type="button"
          >
            {cd ? (
              <div className={styles.cd}>
                <img src={cd.imageUrl} alt={cd.albumName} />
                <div className={styles["cd-info"]}>
                  <h3>{cd.albumName}</h3>
                  <p>{cd.artistName}</p>
                  <button
                    type="button"
                    className={styles["remove-cd"]}
                    onClick={(e) => handleRemoveCD(index, e)}
                    aria-label="Remove CD"
                  >
                    ×
                  </button>
                </div>
              </div>
            ) : (
              <div className={styles["empty-slot"]}>Empty</div>
            )}
          </button>
        ))}
      </div>

      <div className={styles.controls}>
        <div className={styles["transport-controls"]}>
          <button type="button" onClick={previousCD}>
            ⏮
          </button>
          <button
            type="button"
            onClick={previousTrack}
            disabled={!currentCD || currentTrackIndex === 0}
          >
            ⏪
          </button>
          <button type="button" onClick={togglePlayPause} disabled={!currentCD}>
            {isPlaying ? "⏸" : "▶️"}
          </button>
          <button
            type="button"
            onClick={nextTrack}
            disabled={
              !currentCD ||
              !currentCD.tracks ||
              currentTrackIndex === currentCD.tracks.length - 1
            }
          >
            ⏩
          </button>
          <button type="button" onClick={nextCD}>
            ⏭
          </button>
        </div>

        <div className={styles["playback-control"]}>
          <span className={styles.time}>{formatTime(playbackPosition)}</span>
          <input
            type="range"
            className={styles.scrubber}
            min="0"
            max={currentTrack?.duration_ms || 100}
            value={playbackPosition}
            onChange={(e) => handleSeek(Number(e.target.value))}
            style={
              {
                "--value": `${
                  (playbackPosition / (currentTrack?.duration_ms || 100)) * 100
                }%`,
              } as React.CSSProperties
            }
          />
          <span className={styles.time}>
            {formatTime(currentTrack?.duration_ms || 0)}
          </span>
        </div>

        <div className={styles["volume-control"]}>
          <label htmlFor="volume">Volume</label>
          <input
            type="range"
            id="volume"
            min="0"
            max="100"
            value={volume}
            onChange={(e) => handleVolumeChange(Number(e.target.value))}
            style={{ "--value": `${volume}%` } as React.CSSProperties}
          />
        </div>

        <div className={styles["button-controls"]}>
          <button type="button" onClick={() => setShowSearch(true)}>
            Load CD
          </button>
          <button
            type="button"
            onClick={logout}
            className={styles["logout-button"]}
          >
            Logout
          </button>
        </div>
      </div>

      {showSearch && (
        <div className={styles["search-overlay"]}>
          <div className={styles["search-container"]}>
            <button
              type="button"
              className={styles["close-search"]}
              onClick={() => setShowSearch(false)}
            >
              ✕
            </button>
            <SpotifySearch onAlbumSelect={handleAlbumSelect} />
          </div>
        </div>
      )}

      {currentCD && (
        <div className={styles["now-playing"]}>
          <h2>Now Playing</h2>
          {playbackState?.track_window?.current_track ? (
            <>
              <p>
                {playbackState.track_window.current_track.name} -{" "}
                {playbackState.track_window.current_track.artists[0].name}
              </p>
              <p>
                Track {currentTrackIndex + 1} of {currentCD.tracks.length}
              </p>
            </>
          ) : (
            <>
              <p>
                {currentTrack?.name} - {currentCD.artistName}
              </p>
              <p>
                Track {currentTrackIndex + 1} of {currentCD.tracks.length}
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
};
