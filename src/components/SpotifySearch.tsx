import { useState } from "react";
import type { FC } from "react";
import { searchTracks, getAlbumTracks } from "../services/spotify";
import styles from "./SpotifySearch.module.css";

interface SpotifyAlbum {
  id: string;
  albumName: string;
  artistName: string;
  tracks: Array<{
    id: string;
    name: string;
    duration_ms: number;
  }>;
  imageUrl: string;
}

interface SpotifyTrackResponse {
  album: {
    id: string;
    name: string;
    images: Array<{ url: string }>;
    tracks?: {
      items: Array<{ id: string; name: string; duration_ms: number }>;
    };
  };
  artists: Array<{ name: string }>;
}

interface SpotifySearchProps {
  onAlbumSelect: (album: SpotifyAlbum) => void;
}

export const SpotifySearch: FC<SpotifySearchProps> = ({ onAlbumSelect }) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SpotifyAlbum[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;

    setIsLoading(true);
    try {
      const response = await searchTracks(searchQuery);
      const albums = new Map<string, SpotifyAlbum>();

      for (const track of response.tracks.items as SpotifyTrackResponse[]) {
        if (!albums.has(track.album.id)) {
          albums.set(track.album.id, {
            id: track.album.id,
            albumName: track.album.name,
            artistName: track.artists[0].name,
            tracks: track.album.tracks?.items || [],
            imageUrl: track.album.images[0]?.url || "",
          });
        }
      }
      setSearchResults(Array.from(albums.values()));
    } catch (error) {
      console.error("Search failed:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResultClick = async (album: SpotifyAlbum) => {
    try {
      console.log("Fetching tracks for album:", album.id);
      const tracks = await getAlbumTracks(album.id);
      const albumWithTracks = {
        ...album,
        tracks,
      };
      onAlbumSelect(albumWithTracks);
    } catch (error) {
      console.error("Failed to fetch album tracks:", error);
    }
  };

  const handleResultKeyPress = (
    e: React.KeyboardEvent,
    album: SpotifyAlbum
  ) => {
    if (e.key === "Enter" || e.key === " ") {
      onAlbumSelect(album);
    }
  };

  return (
    <div className={styles["spotify-search"]}>
      <div className={styles["search-bar"]}>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search for albums..."
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              handleSearch();
            }
          }}
        />
        <button type="button" onClick={handleSearch} disabled={isLoading}>
          {isLoading ? "Searching..." : "Search"}
        </button>
      </div>

      <div className={styles["search-results"]}>
        {searchResults.map((album) => (
          <button
            key={album.id}
            className={styles["album-result"]}
            onClick={() => handleResultClick(album)}
            type="button"
          >
            {album.imageUrl && (
              <img src={album.imageUrl} alt={album.albumName} />
            )}
            <div className={styles["album-info"]}>
              <h3>{album.albumName}</h3>
              <p>{album.artistName}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};
