import {
  TILE_PROVIDERS,
  SmartFallbackLayer as InternalLayer,
} from "../utils/leafletInit";

// Side-effect của import ở trên: set referrerPolicy + crossOrigin cho mọi
// L.TileLayer (fix lỗi OpenStreetMap 403 do thiếu Referer header).

import { useEffect, useRef } from "react";
import { useMap } from "react-leaflet";

export { TILE_PROVIDERS };

/**
 * TileLayer có fallback tự động:
 *   1. Mặc định dùng OSM.
 *   2. Subdomain fail → blacklist 5 phút.
 *   3. Hết subdomain sạch → switch provider (CartoDB Voyager).
 */
export function SmartTileLayer({ providers = TILE_PROVIDERS, ...options }) {
  const map = useMap();
  const layerRef = useRef(null);

  useEffect(() => {
    if (!map) return undefined;
    const instance = new InternalLayer(providers, options);
    instance.addTo(map);
    layerRef.current = instance;
    return () => {
      if (layerRef.current) {
        map.removeLayer(layerRef.current);
        layerRef.current = null;
      }
    };
    // providers/options là stable config — chỉ tạo layer 1 lần.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map]);

  return null;
}
