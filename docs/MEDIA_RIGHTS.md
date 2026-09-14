# Media Rights and Usage Policy

**Last reviewed:** 2026-07-24

This policy applies the dated legal/platform and newsroom-practice review in
[copyright and media policy research](./research/08-copyright-and-media-policy.md).
It is operational guidance, not a substitute for counsel on a specific use.

## Principle

Availability online is not permission. Every image, video, audio clip,
document, chart, map, screenshot, and embed needs a recorded source, rights
basis, permitted use, attribution, and editorial purpose before publication.

## Allowed sources

- Original newsroom work.
- Licensed stock or news media within contract scope.
- Public-domain media with verified status.
- Compatible Creative Commons material with required attribution and
  derivative/share-alike terms.
- Wikimedia Commons files after checking the individual file page and license.
- Official government media, subject to agency-specific restrictions.
- Official press kits/company media when editorial use is permitted.
- Official platform embeds that remain available under platform terms.
- Reader/contributor submissions with explicit rights and consent.
- Clearly labeled AI-generated illustrations where editorially appropriate.

An allowed category is not blanket approval. Review the individual asset and
use.

## Prohibited use

- Images copied from search results or another publisher without permission.
- Removed/cropped watermarks or rights metadata intended to identify ownership.
- Rehosted copyrighted video/audio without permission.
- Fake documentary images, audio, or video.
- AI depictions that imply a real event occurred.
- Fabricated or misleading depictions of politicians, celebrities, suspects,
  victims, or private people.
- Unrelated celebrity/disaster imagery used for clicks.
- Archive media labeled or visually implied as current.
- Embed-only pages made primarily for advertisements.

## Required asset record

Record:

```text
Original source URL and provider
Creator and copyright owner
License/permission type, evidence URL/file, and restrictions
Attribution text
Download/acquisition date
Original and stored filename
Checksum
MIME/file type, width, height, duration, aspect ratio
Alt text, caption, focal point
Territory/channel/derivative rights
Expiration or review date
Scan, authenticity, and verification state
Reviewer
```

Credentials and signed URLs are not metadata fields.

## Workflow

1. Acquire through an approved source or signed upload.
2. Place the original in private quarantine.
3. Validate magic bytes, size, dimensions/pixels/frames, decode safety, and
   malware state.
4. Verify origin, creator/rightsholder, license, territory, channels,
   derivatives, attribution, and expiry.
5. Assess authenticity, relevance, date, location, manipulation, graphic
   content, privacy, and thumbnail safety.
6. Write factual caption and useful alt text.
7. Approve a version-specific `MediaUsage`.
8. Generate safe derivatives and publish only approved outputs.
9. Monitor expiry/takedown and preserve audit evidence.

An upload or source record alone is not permission to publish.

## Captions, labels, and alt text

Captions say who/what/where/when and identify the source when known. Use visible
labels where context requires:

- `FILE PHOTO`
- `ARCHIVE VIDEO`
- `ILLUSTRATION`
- `AI-GENERATED ILLUSTRATION`
- `SIMULATION` or `REENACTMENT`

Alt text communicates relevant visual information without repeating the caption
or adding unsupported identity/emotion. Decorative media uses empty alt text.

## AI-generated media

AI visuals may explain an abstract concept or serve as a clearly non-documentary
illustration. They may not:

- represent a real news photograph;
- fabricate evidence or a scene of a real allegation/disaster/crime;
- impersonate a real publisher/photographer;
- mislead about a public figure or private person;
- reproduce a protected style/logo/character without rights; or
- remove the required label through crops or syndication.

Prompts, model/provider, generation time, reviewer, and disclosure are recorded.

## Video and audio

For official embeds, identify the original publisher, add editorial context,
respect platform controls, and do not imply ownership. For hosted media, record
distribution, clipping, transcript, caption, music, performance, likeness, and
territorial rights.

Provide captions/transcripts and accessible controls. Use `VideoObject`
structured data only when the page and rights satisfy the schema; an embed
alone does not justify a thin video page.

## Social embeds and screenshots

Embedding does not eliminate privacy, safety, accuracy, or public-interest
review. Deletion/restriction by the original poster may require removal.
Screenshots can create a separate reproduction and rights/privacy issue; use
only the portion necessary and obscure unrelated personal data.

## Sensitive and graphic media

Minimize harm. Require human review for minors, victims, bodies, injury, sexual
content, private locations/data, suspects, and traumatic events. Use warnings
and click-to-reveal only when genuine reader value outweighs harm. Never use a
graphic thumbnail for surprise or engagement.

## Discover and responsive images

Where rights allow, editorial images intended for visual discovery should have
a relevant landscape derivative at least 1200px wide, accurate caption/alt, and
large-preview permission. This is an eligibility practice, not a traffic
guarantee.

Reserve dimensions, prioritize only the lead media, lazy-load later assets, and
avoid layout shift. Transformations must not materially mislead.

## License expiry and takedown

Alerts should fire before expiry. At expiry:

- stop new use;
- apply the contractually required action to existing use;
- replace with an approved asset or preserve a rights-safe placeholder;
- update metadata, caches, social cards, feeds, and Story Intelligence;
- record the action without deleting audit history.

Copyright, privacy, safety, or authenticity complaints are logged and triaged.
Urgent credible claims can temporarily disable delivery while review proceeds.

## Ads and sponsored media

Commercial creative follows separate contracts and scanning but may not
resemble editorial navigation or misuse editorial assets. Sponsorship does not
grant editorial reuse rights.

## Demo content

Use original, public-domain, compatible licensed, or safe generated placeholder
media. Mark illustration/demo context. Do not copy current news photography to
make a reference UI appear authentic.
