import { pool, db } from './index.js';
import { templates } from './schema.js';

const TEMPLATES = [
  {
    name: 'Classic',
    description: 'Clean, traditional layout. Perfect for corporate roles.',
    typstTemplate: `#set page(margin: (top: 2cm, bottom: 2cm, left: 2cm, right: 2cm))
#set text(font: "New Computer Modern", size: 10pt)

#align(center)[
  #text(size: 18pt, weight: "bold")[#data.name]
  #v(4pt)
  #text(size: 10pt, fill: gray)[#data.email | #data.phone | #data.location]
]

#line(length: 100%)

#if data.summary != "" [
  == Summary
  #data.summary
]

== Experience
#for job in data.experience [
  *#job.title* at _#job.company_ #h(1fr) #job.dates
  #job.description
  #v(8pt)
]

== Education
#for edu in data.education [
  *#edu.degree* at _#edu.school_ #h(1fr) #edu.dates
  #v(4pt)
]

== Skills
#data.skills.join(" | ")
`,
  },
  {
    name: 'Modern',
    description: 'Two-column layout with color accents. Great for tech roles.',
    typstTemplate: `#set page(margin: (top: 1.5cm, bottom: 1.5cm, left: 1.5cm, right: 1.5cm))
#set text(font: "New Computer Modern", size: 9pt)

#let accent = rgb("#2563eb")

#grid(columns: (1fr, 2.5fr), gutter: 20pt,
  [
    #text(size: 16pt, weight: "bold", fill: accent)[#data.name]
    #v(8pt)
    #text(size: 8pt)[
      #data.email \\
      #data.phone \\
      #data.location
    ]
    #v(12pt)
    #text(size: 11pt, weight: "bold", fill: accent)[Skills]
    #v(4pt)
    #for skill in data.skills [
      #box(fill: accent.lighten(80%), radius: 3pt, inset: 4pt)[#text(size: 8pt)[#skill]]
      #v(2pt)
    ]
  ],
  [
    #text(size: 11pt, weight: "bold", fill: accent)[Experience]
    #line(length: 100%, stroke: accent)
    #v(4pt)
    #for job in data.experience [
      *#job.title* | _#job.company_ #h(1fr) #text(fill: gray)[#job.dates]
      #v(2pt)
      #job.description
      #v(8pt)
    ]

    #text(size: 11pt, weight: "bold", fill: accent)[Education]
    #line(length: 100%, stroke: accent)
    #v(4pt)
    #for edu in data.education [
      *#edu.degree* | _#edu.school_ #h(1fr) #text(fill: gray)[#edu.dates]
      #v(4pt)
    ]
  ]
)
`,
  },
  {
    name: 'Minimal',
    description: 'Ultra-clean single column. Let your content speak.',
    typstTemplate: `#set page(margin: 2cm)
#set text(font: "New Computer Modern", size: 10pt)

#text(size: 20pt, weight: "bold")[#data.name]
#v(2pt)
#text(size: 9pt, fill: gray)[#data.email \u00b7 #data.phone \u00b7 #data.location]
#v(4pt)
#line(length: 100%, stroke: 0.5pt + gray)

#if data.summary != "" [
  #v(8pt)
  _#data.summary_
  #v(8pt)
]

#for job in data.experience [
  #v(6pt)
  #grid(columns: (1fr, auto),
    [*#job.title*, #job.company],
    [#text(fill: gray)[#job.dates]]
  )
  #v(2pt)
  #job.description
]

#v(12pt)
*Education*
#v(4pt)
#for edu in data.education [
  #grid(columns: (1fr, auto),
    [#edu.degree, _#edu.school_],
    [#text(fill: gray)[#edu.dates]]
  )
  #v(4pt)
]

#v(12pt)
*Skills:* #data.skills.join(" \u00b7 ")
`,
  },
];

async function seed() {
  console.log('Seeding templates...');
  for (const t of TEMPLATES) {
    await db.insert(templates).values(t).onConflictDoNothing();
  }
  console.log(`Seeded ${TEMPLATES.length} templates.`);
  await pool.end();
}

seed().catch(err => { console.error(err); process.exit(1); });
