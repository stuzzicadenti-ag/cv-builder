import { pool, db } from './index.js';
import { templates } from './schema.js';

// Helper functions used in all templates for null-safe field access
const TYPST_HELPERS = `#let get(key, default: "") = if key in data { str(data.at(key)) } else { default }
#let getArr(key) = if key in data and type(data.at(key)) == array { data.at(key) } else { () }
#let has(key) = key in data and str(data.at(key)).len() > 0
#let hasArr(key) = key in data and type(data.at(key)) == array and data.at(key).len() > 0
`;

const TEMPLATES = [
  {
    name: 'Classic',
    description: 'Clean, traditional layout. Perfect for corporate roles.',
    typstTemplate: `${TYPST_HELPERS}
#set page(margin: (top: 2cm, bottom: 2cm, left: 2cm, right: 2cm))
#set text(font: "New Computer Modern", size: 10pt)

#align(center)[
  #text(size: 18pt, weight: "bold")[#get("name")]
  #v(4pt)
  #text(size: 10pt, fill: gray)[
    #let contact = ()
    #if has("email") { contact.push(get("email")) }
    #if has("phone") { contact.push(get("phone")) }
    #if has("location") { contact.push(get("location")) }
    #contact.join(" | ")
  ]
  #if has("linkedin") or has("website") [
    #v(2pt)
    #text(size: 9pt, fill: gray)[
      #let links = ()
      #if has("linkedin") { links.push(get("linkedin")) }
      #if has("website") { links.push(get("website")) }
      #links.join(" | ")
    ]
  ]
  #if has("nationality") or has("dateOfBirth") or has("drivingLicense") [
    #v(2pt)
    #text(size: 9pt, fill: gray)[
      #let extra = ()
      #if has("nationality") { extra.push(get("nationality")) }
      #if has("dateOfBirth") { extra.push(get("dateOfBirth")) }
      #if has("drivingLicense") { extra.push("Driving: " + get("drivingLicense")) }
      #extra.join(" | ")
    ]
  ]
]

#line(length: 100%)

#if has("summary") [
  == Summary
  #get("summary")
]

#if hasArr("experience") [
  == Experience
  #for job in getArr("experience") [
    *#str(job.at("title", default: ""))* at _#str(job.at("company", default: ""))_ #h(1fr) #str(job.at("dates", default: ""))
    #str(job.at("description", default: ""))
    #v(8pt)
  ]
]

#if hasArr("education") [
  == Education
  #for edu in getArr("education") [
    *#str(edu.at("degree", default: ""))* at _#str(edu.at("school", default: ""))_ #h(1fr) #str(edu.at("dates", default: ""))
    #v(4pt)
  ]
]

#if hasArr("skills") [
  == Skills
  #getArr("skills").join(" | ")
]

#if hasArr("languages") [
  == Languages
  #for lang in getArr("languages") [
    *#str(lang.at("name", default: ""))* — #str(lang.at("level", default: ""))
    #h(16pt)
  ]
]

#if hasArr("certifications") [
  #v(4pt)
  == Certifications
  #for cert in getArr("certifications") [
    *#str(cert.at("name", default: ""))* — _#str(cert.at("issuer", default: ""))_ #h(1fr) #str(cert.at("date", default: ""))
    #v(4pt)
  ]
]

#if hasArr("projects") [
  == Projects
  #for proj in getArr("projects") [
    *#str(proj.at("name", default: ""))*
    #if str(proj.at("tech", default: "")).len() > 0 [ | #text(fill: gray)[#str(proj.at("tech", default: ""))]]
    #if str(proj.at("url", default: "")).len() > 0 [ | #text(size: 8pt, fill: gray)[#str(proj.at("url", default: ""))]]
    #v(2pt)
    #str(proj.at("description", default: ""))
    #v(6pt)
  ]
]

#if hasArr("volunteer") [
  == Volunteer Experience
  #for vol in getArr("volunteer") [
    *#str(vol.at("role", default: ""))* at _#str(vol.at("organization", default: ""))_ #h(1fr) #str(vol.at("dates", default: ""))
    #str(vol.at("description", default: ""))
    #v(6pt)
  ]
]

#if hasArr("references") [
  == References
  #for ref in getArr("references") [
    *#str(ref.at("name", default: ""))* — #str(ref.at("position", default: "")), #str(ref.at("company", default: ""))
    #if str(ref.at("contact", default: "")).len() > 0 [ | #str(ref.at("contact", default: ""))]
    #v(4pt)
  ]
]
`,
  },
  {
    name: 'Modern',
    description: 'Two-column layout with color accents. Great for tech roles.',
    typstTemplate: `${TYPST_HELPERS}
#set page(margin: (top: 1.5cm, bottom: 1.5cm, left: 1.5cm, right: 1.5cm))
#set text(font: "New Computer Modern", size: 9pt)

#let accent = rgb("#2563eb")

#grid(columns: (1fr, 2.5fr), gutter: 20pt,
  [
    #text(size: 16pt, weight: "bold", fill: accent)[#get("name")]
    #v(8pt)
    #text(size: 8pt)[
      #if has("email") [#get("email") \ ]
      #if has("phone") [#get("phone") \ ]
      #if has("location") [#get("location") \ ]
      #if has("linkedin") [#get("linkedin") \ ]
      #if has("website") [#get("website") \ ]
    ]
    #if has("nationality") or has("dateOfBirth") [
      #v(6pt)
      #text(size: 8pt, fill: gray)[
        #if has("nationality") [#get("nationality") \ ]
        #if has("dateOfBirth") [#get("dateOfBirth") \ ]
        #if has("drivingLicense") [Driving: #get("drivingLicense") \ ]
      ]
    ]
    #if hasArr("skills") [
      #v(12pt)
      #text(size: 11pt, weight: "bold", fill: accent)[Skills]
      #v(4pt)
      #for skill in getArr("skills") [
        #box(fill: accent.lighten(80%), radius: 3pt, inset: 4pt)[#text(size: 8pt)[#skill]]
        #v(2pt)
      ]
    ]
    #if hasArr("languages") [
      #v(12pt)
      #text(size: 11pt, weight: "bold", fill: accent)[Languages]
      #v(4pt)
      #for lang in getArr("languages") [
        #text(size: 8pt)[*#str(lang.at("name", default: ""))* #str(lang.at("level", default: ""))]
        #v(2pt)
      ]
    ]
    #if hasArr("certifications") [
      #v(12pt)
      #text(size: 11pt, weight: "bold", fill: accent)[Certifications]
      #v(4pt)
      #for cert in getArr("certifications") [
        #text(size: 8pt)[*#str(cert.at("name", default: ""))* \ #text(fill: gray)[#str(cert.at("issuer", default: "")) #str(cert.at("date", default: ""))]]
        #v(4pt)
      ]
    ]
  ],
  [
    #if has("summary") [
      #text(size: 11pt, weight: "bold", fill: accent)[Summary]
      #line(length: 100%, stroke: accent)
      #v(4pt)
      #get("summary")
      #v(8pt)
    ]

    #if hasArr("experience") [
      #text(size: 11pt, weight: "bold", fill: accent)[Experience]
      #line(length: 100%, stroke: accent)
      #v(4pt)
      #for job in getArr("experience") [
        *#str(job.at("title", default: ""))* | _#str(job.at("company", default: ""))_ #h(1fr) #text(fill: gray)[#str(job.at("dates", default: ""))]
        #v(2pt)
        #str(job.at("description", default: ""))
        #v(8pt)
      ]
    ]

    #if hasArr("education") [
      #text(size: 11pt, weight: "bold", fill: accent)[Education]
      #line(length: 100%, stroke: accent)
      #v(4pt)
      #for edu in getArr("education") [
        *#str(edu.at("degree", default: ""))* | _#str(edu.at("school", default: ""))_ #h(1fr) #text(fill: gray)[#str(edu.at("dates", default: ""))]
        #v(4pt)
      ]
    ]

    #if hasArr("projects") [
      #v(4pt)
      #text(size: 11pt, weight: "bold", fill: accent)[Projects]
      #line(length: 100%, stroke: accent)
      #v(4pt)
      #for proj in getArr("projects") [
        *#str(proj.at("name", default: ""))*
        #if str(proj.at("tech", default: "")).len() > 0 [ — #text(fill: gray, size: 8pt)[#str(proj.at("tech", default: ""))]]
        #v(2pt)
        #str(proj.at("description", default: ""))
        #if str(proj.at("url", default: "")).len() > 0 [#v(1pt) #text(fill: gray, size: 7pt)[#str(proj.at("url", default: ""))]]
        #v(6pt)
      ]
    ]

    #if hasArr("volunteer") [
      #v(4pt)
      #text(size: 11pt, weight: "bold", fill: accent)[Volunteer]
      #line(length: 100%, stroke: accent)
      #v(4pt)
      #for vol in getArr("volunteer") [
        *#str(vol.at("role", default: ""))* | _#str(vol.at("organization", default: ""))_ #h(1fr) #text(fill: gray)[#str(vol.at("dates", default: ""))]
        #v(2pt)
        #str(vol.at("description", default: ""))
        #v(6pt)
      ]
    ]

    #if hasArr("references") [
      #v(4pt)
      #text(size: 11pt, weight: "bold", fill: accent)[References]
      #line(length: 100%, stroke: accent)
      #v(4pt)
      #for ref in getArr("references") [
        *#str(ref.at("name", default: ""))* — #str(ref.at("position", default: "")), _#str(ref.at("company", default: ""))_
        #if str(ref.at("contact", default: "")).len() > 0 [ | #text(size: 8pt)[#str(ref.at("contact", default: ""))]]
        #v(4pt)
      ]
    ]
  ]
)
`,
  },
  {
    name: 'Minimal',
    description: 'Ultra-clean single column. Let your content speak.',
    typstTemplate: `${TYPST_HELPERS}
#set page(margin: 2cm)
#set text(font: "New Computer Modern", size: 10pt)

#text(size: 20pt, weight: "bold")[#get("name")]
#v(2pt)
#text(size: 9pt, fill: gray)[
  #let items = ()
  #if has("email") { items.push(get("email")) }
  #if has("phone") { items.push(get("phone")) }
  #if has("location") { items.push(get("location")) }
  #items.join(" \u00b7 ")
]
#if has("linkedin") or has("website") [
  #v(1pt)
  #text(size: 9pt, fill: gray)[
    #let links = ()
    #if has("linkedin") { links.push(get("linkedin")) }
    #if has("website") { links.push(get("website")) }
    #links.join(" \u00b7 ")
  ]
]
#v(4pt)
#line(length: 100%, stroke: 0.5pt + gray)

#if has("summary") [
  #v(8pt)
  _#get("summary")_
  #v(8pt)
]

#if hasArr("experience") [
  #for job in getArr("experience") [
    #v(6pt)
    #grid(columns: (1fr, auto),
      [*#str(job.at("title", default: ""))*, #str(job.at("company", default: ""))],
      [#text(fill: gray)[#str(job.at("dates", default: ""))]]
    )
    #v(2pt)
    #str(job.at("description", default: ""))
  ]
]

#if hasArr("education") [
  #v(12pt)
  *Education*
  #v(4pt)
  #for edu in getArr("education") [
    #grid(columns: (1fr, auto),
      [#str(edu.at("degree", default: "")), _#str(edu.at("school", default: ""))_],
      [#text(fill: gray)[#str(edu.at("dates", default: ""))]]
    )
    #v(4pt)
  ]
]

#if hasArr("skills") [
  #v(12pt)
  *Skills:* #getArr("skills").join(" \u00b7 ")
]

#if hasArr("languages") [
  #v(12pt)
  *Languages:* #getArr("languages").map(l => str(l.at("name", default: "")) + " (" + str(l.at("level", default: "")) + ")").join(" \u00b7 ")
]

#if hasArr("certifications") [
  #v(12pt)
  *Certifications*
  #v(4pt)
  #for cert in getArr("certifications") [
    #grid(columns: (1fr, auto),
      [#str(cert.at("name", default: "")), _#str(cert.at("issuer", default: ""))_],
      [#text(fill: gray)[#str(cert.at("date", default: ""))]]
    )
    #v(4pt)
  ]
]

#if hasArr("projects") [
  #v(12pt)
  *Projects*
  #v(4pt)
  #for proj in getArr("projects") [
    *#str(proj.at("name", default: ""))*
    #if str(proj.at("tech", default: "")).len() > 0 [ — #text(fill: gray, size: 9pt)[#str(proj.at("tech", default: ""))]]
    #v(2pt)
    #str(proj.at("description", default: ""))
    #v(6pt)
  ]
]

#if hasArr("volunteer") [
  #v(12pt)
  *Volunteer*
  #v(4pt)
  #for vol in getArr("volunteer") [
    #grid(columns: (1fr, auto),
      [*#str(vol.at("role", default: ""))*, _#str(vol.at("organization", default: ""))_],
      [#text(fill: gray)[#str(vol.at("dates", default: ""))]]
    )
    #v(2pt)
    #str(vol.at("description", default: ""))
    #v(6pt)
  ]
]

#if hasArr("references") [
  #v(12pt)
  *References*
  #v(4pt)
  #for ref in getArr("references") [
    *#str(ref.at("name", default: ""))* — #str(ref.at("position", default: "")), #str(ref.at("company", default: ""))
    #if str(ref.at("contact", default: "")).len() > 0 [ — #str(ref.at("contact", default: ""))]
    #v(4pt)
  ]
]
`,
  },
];

async function seed() {
  console.log('Seeding templates...');
  // Update existing templates or insert new ones
  for (const t of TEMPLATES) {
    const existing = await pool.query('SELECT id FROM templates WHERE name = $1', [t.name]);
    if (existing.rows.length > 0) {
      await pool.query('UPDATE templates SET typst_template = $1, description = $2 WHERE name = $3', [t.typstTemplate, t.description, t.name]);
      console.log(`  Updated: ${t.name}`);
    } else {
      await db.insert(templates).values(t).onConflictDoNothing();
      console.log(`  Inserted: ${t.name}`);
    }
  }
  console.log(`Seeded ${TEMPLATES.length} templates.`);
  await pool.end();
}

seed().catch(err => { console.error(err); process.exit(1); });
