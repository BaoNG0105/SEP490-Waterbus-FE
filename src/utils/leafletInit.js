import L from "leaflet";

// ───── Global defaults ─────
// OpenStreetMap Foundation (2024+) enforce HTTP Referer — nếu thiếu, tile server
// trả về error tile. Fix theo Leaflet issue #10156.
L.TileLayer.prototype.options.referrerPolicy = "strict-origin-when-cross-origin";
L.TileLayer.prototype.options.crossOrigin = true;

// ───── Tile providers (ưu tiên → fallback) ─────
// Ưu tiên OpenStreetMap — miễn phí, ổn định, không cần API key.
// CartoDB Voyager là fallback khi OSM bị quá tải.
const TILE_PROVIDERS = [
  {
    name: "openstreetmap",
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    subdomains: ["a", "b", "c"],
    maxZoom: 19,
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  },
  {
    name: "cartodb-voyager",
    url: "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
    subdomains: ["a", "b", "c", "d"],
    maxZoom: 20,
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
  },
];

const FAILED_SUBDOMAIN_TTL_MS = 5 * 60 * 1000;

class SmartFallbackLayer extends L.TileLayer {
  constructor(providers, options = {}) {
    const primary = providers[0];
    super(primary.url, {
      ...options,
      subdomains: primary.subdomains,
      maxZoom: primary.maxZoom,
      attribution: primary.attribution,
    });
    this._providers = providers;
    this._activeIdx = 0;
    this._failedSubdomains = new Map();
    this._tilesLoading = new Set();
  }

  _isSubdomainFailed(subdomain) {
    const key = `${this._activeIdx}:${subdomain}`;
    const expiry = this._failedSubdomains.get(key);
    if (!expiry) return false;
    if (Date.now() > expiry) {
      this._failedSubdomains.delete(key);
      return false;
    }
    return true;
  }

  _markSubdomainFailed(subdomain) {
    const key = `${this._activeIdx}:${subdomain}`;
    this._failedSubdomains.set(key, Date.now() + FAILED_SUBDOMAIN_TTL_MS);
  }

  _pickSubdomain(subdomains) {
    const available = subdomains.filter((s) => !this._isSubdomainFailed(s));
    if (available.length === 0) return null;
    const idx = Math.floor((Date.now() / 1000) % available.length);
    return available[idx];
  }

  _switchProvider() {
    const prevIdx = this._activeIdx;
    this._activeIdx = (this._activeIdx + 1) % this._providers.length;
    if (this._activeIdx === prevIdx) return false;
    const next = this._providers[this._activeIdx];
    this.setUrl(next.url);
    this.options.subdomains = next.subdomains;
    this.options.maxZoom = next.maxZoom;
    this.options.attribution = next.attribution;
    this._failedSubdomains.clear();
    return true;
  }

  _buildTileUrl(coords) {
    const provider = this._providers[this._activeIdx];
    const subdomain = coords._pickedSubdomain || "a";
    const r = coords.retina ? "@2x" : "";
    return provider.url
      .replace("{s}", subdomain)
      .replace("{z}", coords.z)
      .replace("{x}", coords.x)
      .replace("{y}", coords.y)
      .replace("{r}", r);
  }

  createTile(coords, done) {
    const tile = document.createElement("img");
    tile.alt = "";
    tile.setAttribute("role", "presentation");

    const provider = this._providers[this._activeIdx];
    const subdomain = this._pickSubdomain(provider.subdomains);
    if (!subdomain) {
      // Hết subdomain sạch → switch provider, retry tile này
      if (this._switchProvider() && this._map) {
        this.redraw();
      }
      done(new Error("no available subdomain"), tile);
      return tile;
    }

    coords._pickedSubdomain = subdomain;
    const tileId = `${coords.z}/${coords.x}/${coords.y}`;
    this._tilesLoading.add(tileId);

    tile.onerror = () => {
      this._tilesLoading.delete(tileId);
      this._markSubdomainFailed(subdomain);
      const retrySub = this._pickSubdomain(provider.subdomains);
      if (retrySub) {
        // Còn subdomain sạch → thử lại ngay tile này
        coords._pickedSubdomain = retrySub;
        tile.onerror = null;
        tile.onload = null;
        tile.src = this._buildTileUrl(coords);
        tile.onload = () => done(null, tile);
        tile.onerror = () => {
          done(new Error("tile load failed"), tile);
        };
        return;
      }
      // Hết subdomain → switch provider, redraw toàn bộ tiles
      if (this._switchProvider() && this._map) {
        this.redraw();
      }
      done(new Error("tile load failed"), tile);
    };

    tile.onload = () => {
      this._tilesLoading.delete(tileId);
      done(null, tile);
    };

    tile.src = this._buildTileUrl(coords);
    return tile;
  }
}

export { TILE_PROVIDERS, SmartFallbackLayer };
