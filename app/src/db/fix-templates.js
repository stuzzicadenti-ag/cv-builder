import { pool } from './index.js';

const HELPERS = `#let get(key, default: "") = if key in data { str(data.at(key)) } else { default }
#let getArr(key) = if key in data and type(data.at(key)) == array { data.at(key) } else { () }
#let has(key) = key in data and str(data.at(key)).len() > 0
#let hasArr(key) = key in data and type(data.at(key)) == array and data.at(key).len() > 0
`;

const CONTACT_BLOCK = `
  #let contact = ()
  #if has("email") { contact.push(get("email")) }
  #if has("phone") { contact.push(get("phone")) }
  #if has("location") { contact.push(get("location")) }
  #contact.join("  |  ")`;

const LINKS_BLOCK = `
  #if has("linkedin") or has("website") [
    #v(2pt)
    #text(size: 9pt, fill: gray)[
      #let links = ()
      #if has("linkedin") { links.push(get("linkedin")) }
      #if has("website") { links.push(get("website")) }
      #links.join("  |  ")
    ]
  ]`;

const EXPERIENCE_BLOCK = (accent, label = "EXPERIENCE") => `
#if hasArr("experience") [
  #v(12pt)
  #text(size: 10pt, weight: "bold", fill: ${accent})[${label}]
  #line(length: 100%, stroke: 0.5pt + ${accent})
  #v(4pt)
  #for job in getArr("experience") [
    #grid(columns: (1fr, auto),
      [*#str(job.at("title", default: ""))* | _#str(job.at("company", default: ""))_],
      [#text(fill: gray)[#str(job.at("dates", default: ""))]]
    )
    #v(2pt)
    #str(job.at("description", default: ""))
    #v(8pt)
  ]
]`;

const EDUCATION_BLOCK = (accent, label = "EDUCATION") => `
#if hasArr("education") [
  #v(4pt)
  #text(size: 10pt, weight: "bold", fill: ${accent})[${label}]
  #line(length: 100%, stroke: 0.5pt + ${accent})
  #v(4pt)
  #for edu in getArr("education") [
    #grid(columns: (1fr, auto),
      [*#str(edu.at("degree", default: ""))* | _#str(edu.at("school", default: ""))_],
      [#text(fill: gray)[#str(edu.at("dates", default: ""))]]
    )
    #v(4pt)
  ]
]`;

const SKILLS_INLINE = (accent) => `
#if hasArr("skills") [
  #v(8pt)
  #text(size: 10pt, weight: "bold", fill: ${accent})[SKILLS]
  #line(length: 100%, stroke: 0.5pt + ${accent})
  #v(4pt)
  #getArr("skills").join("  \\u{2022}  ")
]`;

const SKILLS_TAGS = (accent) => `
#if hasArr("skills") [
  #v(10pt)
  #text(size: 10pt, weight: "bold", fill: ${accent})[TECHNICAL SKILLS]
  #v(4pt)
  #for skill in getArr("skills") [
    #box(fill: ${accent}.lighten(85%), radius: 3pt, inset: (x: 6pt, y: 3pt))[#text(size: 8pt, fill: ${accent}.darken(20%))[#skill]]
    #h(3pt)
  ]
]`;

const LANGUAGES_BLOCK = (accent, label = "LANGUAGES") => `
#if hasArr("languages") [
  #v(10pt)
  #text(size: 10pt, weight: "bold", fill: ${accent})[${label}]
  #v(4pt)
  #for lang in getArr("languages") [
    *#str(lang.at("name", default: ""))* - #str(lang.at("level", default: ""))
    #h(16pt)
  ]
]`;

const CERTS_BLOCK = (accent, label = "CERTIFICATIONS") => `
#if hasArr("certifications") [
  #v(10pt)
  #text(size: 10pt, weight: "bold", fill: ${accent})[${label}]
  #line(length: 100%, stroke: 0.5pt + ${accent})
  #v(4pt)
  #for cert in getArr("certifications") [
    *#str(cert.at("name", default: ""))*, _#str(cert.at("issuer", default: ""))_ #h(1fr) #str(cert.at("date", default: ""))
    #v(4pt)
  ]
]`;

const PROJECTS_BLOCK = (accent, label = "PROJECTS") => `
#if hasArr("projects") [
  #v(10pt)
  #text(size: 10pt, weight: "bold", fill: ${accent})[${label}]
  #line(length: 100%, stroke: 0.5pt + ${accent})
  #v(4pt)
  #for proj in getArr("projects") [
    *#str(proj.at("name", default: ""))*
    #if str(proj.at("tech", default: "")).len() > 0 [ | #text(fill: gray, size: 8pt)[#str(proj.at("tech", default: ""))]]
    #if str(proj.at("url", default: "")).len() > 0 [ | #text(fill: gray, size: 7pt)[#str(proj.at("url", default: ""))]]
    #v(2pt)
    #str(proj.at("description", default: ""))
    #v(6pt)
  ]
]`;

const VOLUNTEER_BLOCK = (accent, label = "VOLUNTEER") => `
#if hasArr("volunteer") [
  #v(10pt)
  #text(size: 10pt, weight: "bold", fill: ${accent})[${label}]
  #line(length: 100%, stroke: 0.5pt + ${accent})
  #v(4pt)
  #for vol in getArr("volunteer") [
    *#str(vol.at("role", default: ""))* | _#str(vol.at("organization", default: ""))_ #h(1fr) #text(fill: gray)[#str(vol.at("dates", default: ""))]
    #v(2pt)
    #str(vol.at("description", default: ""))
    #v(6pt)
  ]
]`;

const REFERENCES_BLOCK = (accent, label = "REFERENCES") => `
#if hasArr("references") [
  #v(10pt)
  #text(size: 10pt, weight: "bold", fill: ${accent})[${label}]
  #line(length: 100%, stroke: 0.5pt + ${accent})
  #v(4pt)
  #for ref in getArr("references") [
    *#str(ref.at("name", default: ""))*, #str(ref.at("position", default: "")), _#str(ref.at("company", default: ""))_
    #if str(ref.at("contact", default: "")).len() > 0 [ | #str(ref.at("contact", default: ""))]
    #v(4pt)
  ]
]`;

// ===================== EXECUTIVE =====================
const executive = HELPERS + `
#set page(margin: (top: 2cm, bottom: 2cm, left: 2.5cm, right: 2.5cm))
#set text(font: "New Computer Modern", size: 10.5pt)
#set par(justify: true)

#let accent = rgb("#1e293b")

#align(center)[
  #text(size: 22pt, weight: "bold", fill: accent)[#get("name")]
  #v(6pt)
  #text(size: 10pt, fill: gray.darken(20%))[${CONTACT_BLOCK}]
  ${LINKS_BLOCK}
]
#v(8pt)
#line(length: 100%, stroke: 1.5pt + accent)

#if has("summary") [
  #v(10pt)
  #text(size: 11pt, weight: "bold", fill: accent)[EXECUTIVE SUMMARY]
  #v(4pt)
  #get("summary")
]
${EXPERIENCE_BLOCK('accent', 'PROFESSIONAL EXPERIENCE')}
${EDUCATION_BLOCK('accent')}
${SKILLS_INLINE('accent')}
${LANGUAGES_BLOCK('accent')}
${CERTS_BLOCK('accent')}
${PROJECTS_BLOCK('accent', 'KEY PROJECTS')}
${VOLUNTEER_BLOCK('accent', 'COMMUNITY INVOLVEMENT')}
${REFERENCES_BLOCK('accent')}
`;

// ===================== CREATIVE =====================
const creative = HELPERS + `
#set page(margin: 1.5cm)
#set text(font: "New Computer Modern", size: 9.5pt)

#let primary = rgb("#7c3aed")
#let light = rgb("#ede9fe")

#box(fill: primary, width: 100%, inset: 16pt, radius: 6pt)[
  #text(size: 20pt, weight: "bold", fill: white)[#get("name")]
  #v(4pt)
  #text(size: 9pt, fill: white.darken(10%))[
    #let items = ()
    #if has("email") { items.push(get("email")) }
    #if has("phone") { items.push(get("phone")) }
    #if has("location") { items.push(get("location")) }
    #if has("linkedin") { items.push(get("linkedin")) }
    #if has("website") { items.push(get("website")) }
    #items.join("  \\u{2022}  ")
  ]
]

#if has("summary") [
  #v(12pt)
  #text(size: 10pt, weight: "bold", fill: primary)[About Me]
  #v(4pt)
  _#get("summary")_
]

#if hasArr("experience") [
  #v(12pt)
  #text(size: 10pt, weight: "bold", fill: primary)[Experience]
  #v(4pt)
  #for job in getArr("experience") [
    #box(fill: light, width: 100%, inset: 10pt, radius: 4pt)[
      *#str(job.at("title", default: ""))* at _#str(job.at("company", default: ""))_ #h(1fr) #text(fill: gray)[#str(job.at("dates", default: ""))]
      #v(3pt)
      #str(job.at("description", default: ""))
    ]
    #v(6pt)
  ]
]

#if hasArr("education") [
  #v(8pt)
  #text(size: 10pt, weight: "bold", fill: primary)[Education]
  #v(4pt)
  #for edu in getArr("education") [
    #box(fill: light, width: 100%, inset: 10pt, radius: 4pt)[
      *#str(edu.at("degree", default: ""))* | _#str(edu.at("school", default: ""))_ #h(1fr) #text(fill: gray)[#str(edu.at("dates", default: ""))]
    ]
    #v(4pt)
  ]
]

#if hasArr("skills") [
  #v(8pt)
  #text(size: 10pt, weight: "bold", fill: primary)[Skills]
  #v(4pt)
  #for skill in getArr("skills") [
    #box(fill: primary.lighten(75%), radius: 12pt, inset: (x: 8pt, y: 4pt))[#text(size: 8pt, fill: primary.darken(20%))[#skill]]
    #h(4pt)
  ]
]
${LANGUAGES_BLOCK('primary', 'Languages')}
${CERTS_BLOCK('primary', 'Certifications')}
${PROJECTS_BLOCK('primary', 'Projects')}
${VOLUNTEER_BLOCK('primary', 'Volunteer')}
${REFERENCES_BLOCK('primary', 'References')}
`;

// ===================== TECHNICAL =====================
const technical = HELPERS + `
#set page(margin: (top: 1.5cm, bottom: 1.5cm, left: 1.5cm, right: 1.5cm))
#set text(font: "New Computer Modern", size: 9pt)

#let accent = rgb("#059669")

#text(size: 18pt, weight: "bold")[#get("name")]
#v(2pt)
#text(size: 9pt, fill: gray)[
  #let items = ()
  #if has("email") { items.push(get("email")) }
  #if has("phone") { items.push(get("phone")) }
  #if has("location") { items.push(get("location")) }
  #if has("linkedin") { items.push(get("linkedin")) }
  #if has("website") { items.push(get("website")) }
  #items.join(" | ")
]
#v(6pt)
#line(length: 100%, stroke: 2pt + accent)

#if has("summary") [
  #v(8pt)
  #get("summary")
]
${SKILLS_TAGS('accent')}
${EXPERIENCE_BLOCK('accent')}
${PROJECTS_BLOCK('accent', 'PROJECTS')}
${EDUCATION_BLOCK('accent')}
${CERTS_BLOCK('accent', 'CERTIFICATIONS')}
${LANGUAGES_BLOCK('accent', 'LANGUAGES')}
${VOLUNTEER_BLOCK('accent', 'VOLUNTEER')}
${REFERENCES_BLOCK('accent', 'REFERENCES')}
`;

async function fixTemplates() {
  // Update admin-created templates that lack null-safe helpers
  const result = await pool.query('SELECT id, name FROM templates');
  const templateMap = {};
  for (const row of result.rows) {
    templateMap[row.name] = row.id;
  }

  if (templateMap['Executive']) {
    await pool.query('UPDATE templates SET typst_template = $1 WHERE id = $2', [executive, templateMap['Executive']]);
    console.log(`Updated Executive (${templateMap['Executive']})`);
  }
  if (templateMap['Creative']) {
    await pool.query('UPDATE templates SET typst_template = $1 WHERE id = $2', [creative, templateMap['Creative']]);
    console.log(`Updated Creative (${templateMap['Creative']})`);
  }
  if (templateMap['Technical']) {
    await pool.query('UPDATE templates SET typst_template = $1 WHERE id = $2', [technical, templateMap['Technical']]);
    console.log(`Updated Technical (${templateMap['Technical']})`);
  }

  // Also fix ANY template that still uses direct #data.field access without helpers
  const allTemplates = await pool.query('SELECT id, name, typst_template FROM templates');
  for (const t of allTemplates.rows) {
    if (!t.typst_template.includes('#let get(')) {
      console.log(`WARNING: Template "${t.name}" (${t.id}) still lacks null-safe helpers!`);
    }
  }

  console.log('Done fixing templates.');
  await pool.end();
}

fixTemplates().catch(err => { console.error(err); process.exit(1); });
