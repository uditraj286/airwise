# ADR-0002: Blend nearby stations and calibrate the forecast to them

**Status:** Accepted

## Context
The CAMS forecast model (via Open-Meteo) can be far off locally: in one test it showed AQI 335 where the nearest CPCB station measured 82. Families judged the app by whether its AQI matched their area. A single nearest station can also be skewed by a busy junction.

## Decision
- Download the national CPCB feed once a minute (shared by all users) and choose stations on the server, so no location leaves our server.
- Use every fresh station within **30 km**, weighted by inverse distance squared, to get one area AQI.
- **Calibrate** the model: find the factor (capped 0.25–4×, by bisection) that makes the model's current AQI equal the stations' AQI, and scale the whole hourly series by it. The forecast keeps its shape but sits at the measured level, so the headline AQI, fine smoke, timeline, charts and alerts all agree.
- Outside India or with no station nearby, show the model and label it as an estimate.

## Consequences
- The numbers are measured where available and consistent everywhere.
- The station feed currently comes from a public relay; see `SECURITY.md` for safeguards and the production path (data.gov.in).
