# Migration Lens

An immersive web app for following real birds through migration. Open on a turkey vulture's September 2021 flight from Arizona through western Mexico. Rotate a first-person camera, follow the bird from behind, or inspect its route on a globe. Playback supports real time and accelerated forward/backward speeds, ten-minute recorded-time steps, civil flight-day selection, timeline seeking, local and UTC clocks, sunlight tied to the flight time, and a map of the complete journey. Choose a species, an individual bird, then a migration: the catalog has 68 birds and 69 journeys across 12 species. Camera stabilization is on by default for First person and Follow. Wind, precipitation and temperature are independently selectable historical overlays. Jump notices can be switched off for uninterrupted playback. Nearby Street View opens in Google Maps where panorama coverage exists.

Live app: [Migration Lens](https://chenyangkang.github.io/Migration-Lens/). Source: [GitHub](https://github.com/chenyangkang/Migration-Lens).

## Run

The web app has no server dependencies. Rebuild the static files with Node 20 or newer:

```sh
node scripts/00_setup/build.mjs
python3 -m http.server 4173 --bind 127.0.0.1 --directory dist
```

Open http://127.0.0.1:4173/. Internet access and a browser supporting WebGL are required for the globe, imagery and terrain. 

The Python server is for local preview. `dist/` is a static deployable site and can be served by any static host. No credentials are stored in this repository.

## Project layout

- `scripts/00_setup/`: static build entry point.
- `scripts/01_shared_helpers/`: spherical interpolation, stable camera movement, playback, gap handling, historical local-time formatting and solar geometry.
- `scripts/02_web_app/`: interface, globe, terrain provider and route map.
- `scripts/03_data_preparation/`: reproducible archive curation.
- `scripts/04_multi_species/`: normalization of public goose and crane migrations.
- `data/04_multi_species/`: additional species in the shared journey schema.
- `scripts/05_individual_catalog/` and `data/05_individual_catalog/`: additional identified birds and migration years.
- `scripts/06_environment/` and `data/06_environment/`: preparation and packaged hourly weather along the migration corridors.
- `scripts/07_tests/`: meaningful playback, camera and data validation tests.
- `scripts/08_diverse_migrations/` and `data/08_diverse_migrations/`: expanded public GPS migration selections and retained source event identifiers.
- `data/03_data_preparation/`: curated observations and deployment metadata.
- `figures/04_product/`: verified product screenshots.
- `resources/`: provenance, reference material and configuration.
- `dist/`: packaged browser app.

## Real data

Source: Bildstein KL, Barber D, Bechard MJ, Graña Grilli M, Therrien J. 2021. Data from: Study “Vultures Acopian Center USA GPS” (2003–2021). Movebank Data Repository. https://doi.org/10.5441/001/1.f3qt46r2.

The download contains 1,772,639 GPS records for several birds. The original preparation stages package three selections; the expanded stage adds four more birds:

| Bird | Period | Retained fixes | Median interval | Recorded flight days |
| --- | --- | ---: | ---: | ---: |
| Peter | 3–21 September 2021, bird local dates | 7,794 | 60 seconds | 19 |
| Steve | 29 September–26 October 2021, bird local dates | 234 | 3,600 seconds | 28 |
| Leo | 25 September–31 October 2016, bird local dates | 206 | 3,600 seconds | 30 |

Peter travelled through Arizona, Sonora and Sinaloa. Leo's packaged selection spans Saskatchewan to Nicaragua; an earlier label incorrectly described this segment as ending in Venezuela. Distances are sums of straight great-circle distances between retained observations, including gaps: 2,564.9 km and 5,961.9 km respectively. These are approximate observed routes, not exact flight distances.

The archive's related paper is Mallon, Bildstein & Fagan (2021), *Inclement weather forces stopovers and prevents migratory progress for obligate soaring migrants*, https://doi.org/10.1186/s40462-021-00274-6. It analysed earlier migrations (2006–2019); The 2021 Peter and Steve selections are not claimed to be one of its analysed migrations.

Repository metadata states CC BY 4.0; its bundled README states CC0. This app preserves attribution and follows the CC BY attribution condition. See `resources/data_manifest.json` for the source hash, URL and transformations. The 309 MB raw archive is not copied into the site's source or deployment.

To reproduce the curated data, install `requirements.txt`, download the CSV using the URL in `resources/data_manifest.json`, then run:

```sh
python3 scripts/03_data_preparation/prepare_tracks.py /path/to/archive.csv
node scripts/00_setup/build.mjs
```

## Interpretation and limits

The camera interpolates between real coordinates on a great circle. It does not simulate the bird's visual system or measured head orientation. Travel bearing determines forward direction. Peter's intervals over 10 minutes and Leo's intervals over 2 hours are skipped; trajectories across these gaps are not invented. Drag to look around; Space plays or pauses; arrow keys look around; R resets the view.

The archive supplies Peter and Leo's numeric altitude in `height-raw`, with no explicit vertical datum. Values are treated as metres for rendering and labelled as approximate. Camera height may be raised above loaded terrain to avoid clipping. No reliable height above ground, vertical datum conversion, head pose or exact flight-day imagery is claimed. Weather overlays describe near-surface model estimates rather than measured conditions at bird height. All retained observations come from the archive; no synthetic bird positions are included.

## Local time and daylight

The clock defaults to the bird's local civil time, with UTC shown alongside it. The Local/UTC selector changes the primary clock. Each retained fix has an IANA zone assigned offline using the full geographic boundary dataset in `timezonefinder==8.2.2`; modern boundaries are used. Browser `Intl.DateTimeFormat` supplies offsets and daylight-saving rules for the recorded date. The nearest observed fix supplies the zone between observations; a GPS gap keeps the last observed zone. Sinaloa in September 2021 displays UTC−6, including its historical DST, whereas Arizona and Sonora display UTC−7. No coordinates are sent to a timezone service.

Flight-day buttons use each observation's civil local date. The original curation trimmed UTC−7 selection windows to first and last active fixes; local-time enrichment retains the same 8,000 GPS observations and only regroups day labels. The reduced boundary dataset bundled with timezonefinder 8.0/8.1 merges places with different historical timekeeping and is rejected by the preparation helper.

Day/night lighting is on by default. Cesium's clock follows the flight timestamp, driving sunlight, sky, terrain and atmosphere. Lighting fade distances are adjusted so sun shading remains active at bird flight height. Daylight view disables the time-dependent illumination for landscape exploration. A phase badge uses the NOAA/Meeus solar equations and conventional twilight thresholds relative to an unobstructed ground horizon; altitude and local terrain horizon effects are not included in that badge. The reconstruction does not reproduce historical clouds, weather, artificial lighting or the bird's visual sensitivity.

The 24h light preview pauses migration, holds the current track position, and animates only the lighting clock at 30 minutes per second. Its separate clock and slider are explicitly labelled as a preview. Scrubbing pauses the preview; Play resumes it. The preview finishes after 24 hours. Closing it or selecting a flight day returns lighting to the recorded flight timestamp. Normal migration playback skips missing-data intervals, so these mainly daytime vulture tracks should not be interpreted as observed overnight flight.

References: [IANA timezone database](https://www.iana.org/time-zones), [full timezone boundary data](https://github.com/evansiroky/timezone-boundary-builder), [NOAA solar equations](https://gml.noaa.gov/grad/solcalc/calcdetails.html), and [Cesium globe lighting](https://cesium.com/learn/cesiumjs/ref-doc/Globe.html).

The one-second golden-eagle flight described by Garstang et al. (2022), DOI 10.3390/ani12111470, remains a future data candidate. Its accessible supplement has figures and tables but no raw coordinate file. Osprey study 8868155 requires the owner's permission before downloading for this use. Neither unavailable source is represented by invented GPS data.

## Landscape services

CesiumJS 1.137 is pinned through its official CDN. Satellite imagery is requested from Esri World Imagery. Terrain uses public Mapzen Terrarium tiles from the AWS Open Data collection, decoded into a Cesium heightmap. The mini-map uses OpenStreetMap tiles and retains attribution. All service credits appear in the app. External services may have outages or incomplete coverage; terrain resolution and satellite detail vary by region.

The terrain provider caps source zoom at 12 and maintains a bounded cache. It renders land heights at zero or greater. Camera height is approximate because terrain height and raw GPS height do not have verified matching vertical datums. Google Maps links request nearby ground panoramas, not aerial images.

## Verification

```sh
node --test scripts/07_tests/*.test.mjs
```

Tests verify interpolation, missing-data gaps, overnight skipping, end-of-track handling, date-line travel, packaged-coordinate validity, historical Mexican DST, civil date rollover, timezone changes, day grouping and solar geometry. Browser checks cover play/pause, camera rotation, follow/overview, journey and day selection, timeline, provenance, mobile layout, local/UTC switching, day/night illumination and the held-position 24h preview. Tests also verify the multi-species catalog, stopped gap transitions, unknown crane altitude, estimated segment speeds and real nighttime goose observations. The optional WebMCP playback tool uses the same visible actions and rejects invalid inputs before changing state.

## Additional species

Public USGS releases add three journeys to the same catalog, controls and playback engine:

| Species | Individual | Period (UTC) | Fixes | Typical spacing | Route |
| --- | --- | --- | ---: | --- | --- |
| Greater white-fronted goose | gwf_171615.1 | April 17–20, 2021 | 267 | 15 minutes | California coast to Alaska |
| Snow goose | lsn_180789.1 | October 12–13, 2019 | 54 | 15 minutes | Gulf of Alaska to Washington |
| Sandhill crane | 100845 | September 1–October 22, 2013 | 74 | 6 hours | Alaska to New Mexico |

Goose source: Weiser et al. (2024), [Movement Data for Migrating Geese Over the Northeast Pacific Ocean, 2018–2021](https://doi.org/10.5066/P9VUN0Q9). Related study: [Geese migrating over the Pacific Ocean select altitudes coinciding with offshore wind turbine blades](https://doi.org/10.1111/1365-2664.14612). Only `used=1` GPS observations from seven named bouts are retained; `used=0` model alternatives are excluded. The supplied original GPS altitude is retained, without substituting adjusted analysis altitudes. Both daytime and nighttime observations are present. Speeds are estimated segment means; the release does not supply instantaneous ground speed.

Crane source: Pearse et al. (2017), [Sandhill crane locations, autumn 2013 migration](https://doi.org/10.5066/F7F76BGR). Individual 100845 has 74 unique timestamps from 75 released locations. The published kilometre coordinates are inverted using the documented azimuthal equidistant projection (51° N, 110° W, GRS80). This is a broad-route dataset with no altitude field. It opens in Route view; first-person viewing uses an illustrative 750 m above loaded terrain and displays altitude as unavailable. These public-domain releases request citation.

`resources/configs/journey_catalog.json` lists all normalized datasets. The build validates identities, ordered coordinates, explicit missing altitude, local zones and day coverage before combining them. To add a track, provide the same metadata and observation schema and register its dataset in this catalog. `resources/multi_species_manifest.json` records source hashes and selections.

To reproduce the additional data, download the original CSVs from the source releases and run:

```sh
python3 scripts/04_multi_species/prepare_migrations.py --geese /path/to/goose_migrationAltitude_nePacific_weiser.csv --cranes /path/to/sacr_locations.csv
```

## Recording gaps

With **Show jump notices** checked, before an automatic jump the app holds for three real seconds and displays the missing interval's duration, last and next fix times, and source-specific explanation. Pause here stops the countdown; Jump to next fix goes to the exact next observation. A confirmation notice follows the jump. Uncheck **Show jump notices** for immediate jumps without the countdown, card or toast. The setting and weather-layer choices are saved in browser local storage; manual gap inspection stays available. Hatched timeline areas and a selectable Recording gaps list make these intervals inspectable. Dashed map links connect known endpoints for orientation and do not claim a measured route. Seeking inside a gap holds the last recorded position.

Gaps describe the curated display, not necessarily a failed recorder. Vulture selections omit periods outside their active-flight windows; the original archive may have additional fixes. Goose release filtering and tag schedules can produce gaps without a stated cause. Nighttime overlap is calculated at the last recorded location and is explicitly not presented as the cause. Interpolation limits are 10 minutes (Peter), 2 hours (Leo and Steve), 45 minutes (geese), and 18 hours (crane). Smaller intervals still interpolate; sparse crane tracks are appropriate for broad route exploration.

## Publication

The GitHub Pages workflow tests and builds the static app before deployment. Set the repository's Pages source to GitHub Actions once; subsequent pushes to `main` update the public site automatically. The deployment uploads only `dist/`. No Movebank login, API tokens or private credentials are required by the public app. Original data licenses and attributions remain in each journey.

## Individuals and migration years

The interface groups 69 journeys by 12 species and 68 individually identified birds. Each species has at least two birds; the Orinoco goose archive contains a tracked pair.

| Species | Birds | Example route |
| --- | ---: | --- |
| Turkey vulture | 7 | Canada / Arizona to Central and South America |
| Greater white-fronted goose | 13 | Northeast Pacific, including five Tule individuals |
| Snow goose | 5 | Alaska to the Pacific Northwest |
| Sandhill crane | 5 | Bering coast to Mexico / the southwestern U.S. |
| White stork | 3 | Portugal / Spain across the Sahara |
| Black kite | 8 | Strait of Gibraltar migration crossings |
| Orinoco goose | 2 | Manú, Peru to the Llanos de Moxos, Bolivia |
| Barnacle goose | 7 | Ireland through Iceland to Greenland |
| Taiga bean goose | 6 | Finland to Arctic moult grounds on Novaya Zemlya |
| Brown pelican | 4 | Southeastern U.S. coast to Florida / Cuba |
| Demoiselle crane | 4 | East Asia to India |
| White-naped crane | 4 | Transbaikalia to eastern China |

The white-fronted goose `gwf_171615.1` offers published spring bouts from both 2019 and 2021. Steve's 234 retained hourly fixes span Arizona through Central America to northern Colombia. The two additional cranes terminate in northern Mexico, rather than being labelled as U.S. destinations. All individual identifiers are retained from their archives; no birds are invented. See `resources/individual_catalog_manifest.json` for selections and provenance.

To reproduce the expanded catalog from the same original source files:

```sh
python3 scripts/05_individual_catalog/prepare_individuals.py --vultures /path/to/archive.csv --geese /path/to/goose_migrationAltitude_nePacific_weiser.csv --cranes /path/to/sacr_locations.csv
```

## Historical environment

Select any combination of **Wind strength & direction**, **Precipitation** and **Temperature**, or **None · clear layers**. The main globe shows analytical colour cells and wind arrows; the mini-map follows the bird and shows the regional weather field. Nearby terrain arrows bring the wind layer into first-person view. Longer arrows represent stronger winds and point toward the direction of travel. The reading reports the meteorological direction **from** which the wind blows. Calm winds are labelled without an arbitrary direction.

These are **hourly ERA5 reanalysis surface estimates**, supplied by the [Open-Meteo Historical Weather API](https://open-meteo.com/en/docs/historical-weather-api) from ECMWF/Copernicus, with CC BY 4.0 attribution. Wind is at 10 m and temperature at 2 m above the surface; the estimates do not describe measured wind at flight altitude. Precipitation is the preceding-hour total, including snow as water equivalent, in millimetres. Weather values use the last hourly timestamp, without interpolating rain totals in time. Wind interpolation uses east/north vector components, avoiding erroneous direction changes across north. Missing data are unavailable, never substituted with zero.

ERA5's native grid is 0.25°. This release downloads **1° corridor samples** bordering recorded fixes and short great-circle segments, including ocean cells, with elevation downscaling disabled. Point readings and nearby wind arrows interpolate between these samples; coloured cells and regional arrows show node values. This display sampling is coarser than the underlying model. It is suitable for regional context, not fine-scale flight aerodynamics, turbulence or causal inference. Weather does not modify the sunlight model or synthesize historical clouds. A light preview keeps weather at the original flight time; a GPS gap uses the held last-fix location without implying that the bird stayed there.

Approximately 70 MB of prepared weather is bundled as one static JSON file per journey and loaded only when a layer is enabled. GitHub Pages serves these files with the app; visitors make **no weather API requests and need no weather key or login**. The browser keeps at most three decoded weather journeys cached. Public tracking data and weather provenance remain in the source repository.

Reproduce the weather, then build:

```sh
python3 scripts/06_environment/prepare_environment.py --cache /tmp/migration_lens_weather_cache
node scripts/00_setup/build.mjs
```

The preparation script respects short pauses between public requests and reuses downloaded results. Use Open-Meteo's [API terms and limits](https://open-meteo.com/en/terms) when rebuilding; the free endpoint is for noncommercial use. `resources/environment_manifest.json` contains variable definitions, exact requests, native/display resolution and per-file hashes. The existing GitHub Actions workflow publishes the complete static app after passing the tests.

## Fast forward and rewind

Use **−10m** and **+10m** beside Play to move backward or forward by ten minutes of recorded/interpolated flight time. Long GPS gaps do not consume that interval: the control skips to the appropriate recorded endpoint and spends the remaining time within valid segments. Thus a ten-minute step can change the calendar clock by much more than ten minutes. When jump notices are enabled, an explicit step briefly reports skipped gaps; disabling notices keeps these steps quiet. Playback keeps its current running/paused state unless it reaches its end in the selected direction.

For continuous fast forward or rewind, choose **Forward** or **Backward** and a **Playback speed**, then Play. The same accelerated speeds work in either direction. Rewinding stops at the first fix, and reverse gap notices hold at the later fix before jumping to the earlier fix. The reconstructed camera keeps the original flight bearing while the recording runs backward; weather, local/UTC clocks and sunlight follow the selected historical time. Previous/next-day buttons remain available. Keyboard **[** and **]** step back or ahead; Space plays or pauses.


## Camera stabilization

**Stabilize camera** is on by default in First person and Follow and is remembered in the browser. Face forward uses the stabilized travel direction. Unchecking it shows adjacent-fix bearings for comparison. Route geometry, bird marker, GPS measurements and weather sampling retain their original positions.

Direction uses a great-circle chord within the same uninterrupted GPS segment, looking ahead and behind by `clamp(2 × median interval, 300 s, 21600 s)`. The window can expand up to threefold when the net displacement is small relative to the travelled path. When displacement is under 80 m or path coherence stays below 0.25, the camera holds its prior heading. Circular angle smoothing has a 1.4-second response, a 1.2° deadband and a **28°/second wall-time turn limit**, independent of playback speed or direction. Sustained turns still change the view.

Fine-resolution tracks (median interval ≤300 s) also use a five-sample weighted camera position with a maximum **150 m offset** from the interpolated track. Camera height changes are damped, with a terrain clearance floor. These are viewing adjustments, not replacements for GPS observations. All camera smoothing resets on a seek, journey change or recording-gap transition and never crosses a missing section. On Peter’s actual track, the broader target bearing reduces total absolute adjacent heading variation by about **84%**; this measures bearing variation, not a claim about the bird’s head movement.

## Expanded archive sources

The expanded stage adds 56 GPS selections with licensed redistribution and source-specific curation:

- White stork: Acácio et al., [migration timing and destinations](https://doi.org/10.5441/001/1.137cn005), CC0. Original bursts are sampled using the first actual fix per 30-second bucket; fixes without usable reported flight height are excluded. Longer gaps between bursts remain visible.
- Black kite: Santos et al., [sea-crossing performance at Gibraltar](https://doi.org/10.5441/001/1.r9g07dr8), CC0. The source has one-second fixes; the viewer retains fixes with reported height, typically at ten-second spacing. These are short migration-bottleneck segments.
- Orinoco goose: Davenport et al., [East with the night](https://doi.org/10.5441/001/1.ct8sk835), CC0. Both members of the tracked pair are included. The male’s daily fixes are substantially sparser than the female’s, and most male intervals are treated as gaps. Height is unavailable.
- Barnacle goose: Cabot, [Greenland spring migration](https://doi.org/10.5441/001/1.5d3f0664), CC0. Seven real individuals; hourly or two-hourly GPS. Inconsistent raw-height flags are not used for camera height.
- Taiga bean goose: Piironen et al., [moult migration to Novaya Zemlya](https://doi.org/10.5441/001/1.22kk5126), CC0. Six birds, with early-summer travel and arrival selected. This is moult migration, rather than breeding migration; GPS heights reference the ellipsoid.
- Brown pelican: Lamb et al., [annual-cycle movement of Eastern Brown Pelicans](https://doi.org/10.5441/001/1.715), CC0. Four autumn-to-winter selections. Sparse GPS supports broad-route viewing; the mostly missing and implausible altitude values are deliberately not used.
- Demoiselle and white-naped cranes: Ilyashenko et al., [1000 Cranes, Transbaikalia](https://doi.org/10.5441/001/1.592), CC BY 4.0. Four birds of each species. Long missing sections remain explicit; sparse selections open in Route view.

Four more Turkey vultures, twelve more Pacific goose bouts, and two Alaska-to-Texas crane legs use the original Movebank/USGS sources. Tule geese remain grouped within Greater white-fronted goose: a subspecies is not counted as another species. The newly selected Sandhill crane legs exclude the earlier Russia portion of their published tracks; they are not presented as complete migrations from Russia. Vulture daytime selections retain the original curation rules.

`resources/configs/diverse_migrations.json` records download URLs and chosen UTC windows. `resources/diversity_manifest.json` records hashes, citations, licenses and curation. New Movebank selections retain an original event ID for every displayed fix. No synthetic birds or GPS fixes are added. Source heights in mean sea level and ellipsoid datums remain explicitly distinguished; no conversion to a common vertical datum is claimed.

Reproduce this stage from the original source CSVs (downloads are cached outside the repository):

```sh
python3 scripts/08_diverse_migrations/prepare_diverse_migrations.py --source-dir /path/to/archive_cache --download --vultures /path/to/vultures.csv --geese /path/to/goose_migrationAltitude_nePacific_weiser.csv --cranes /path/to/sacr_locations.csv
python3 scripts/06_environment/prepare_environment.py
node scripts/00_setup/build.mjs
```
