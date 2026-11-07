/**
 * "What Makes Us Different" — draft copy (Australian English). Everything here is editable in the admin
 * (Club → What Makes Us Different); an empty admin field falls back to this draft.
 */
export const DIFFERENCE = {
  hero: {
    title: 'What makes us different',
    intro: 'Paid, professionally trained coaches, a real football curriculum and a year-round program — built so every player knows what they’re working on and what comes next.',
  },
  coaches: {
    nav: 'Coaches',
    headline: 'Paid, professionally developed coaches',
    body: 'Every session is led by a paid coach who has completed our professional development program. That means qualified, consistent and accountable coaching for your child — every week, all year.',
    more: 'Before they coach a single session, our coaches complete a 10-week professional development program that teaches them to deliver sessions “the Foundation way”. They learn our lesson sequence, how children learn, how to communicate with and motivate young players, how to break down technique, and how to use constraints to develop it. Just as importantly, they learn who we are — our culture and our values — so every coach is aligned from day one.',
  },
  curriculum: {
    nav: 'Curriculum',
    headline: 'A real football curriculum',
    body: 'Modelled on the Victorian school curriculum, our football curriculum runs from Foundation level (up to age 7) through every age to 13. Each player follows a clear progression, so players and parents always know what they’re working on and what comes next.',
    more: 'Each level sets out achievement standards across six strands. Coaches plan sessions against those standards, track progress through the year, and report on it — the same way a good school does.',
    strands: [
      { name: 'Attacking', line: 'Creating and finishing chances, alone and with teammates.' },
      { name: 'Defending', line: 'Winning the ball back and protecting our goal together.' },
      { name: 'Physical', line: 'Speed, agility, balance and coordination for football.' },
      { name: 'Passing & Receiving', line: 'Moving the ball with purpose and controlling it under pressure.' },
      { name: 'Tactical', line: 'Reading the game and making good decisions.' },
      { name: 'Character', line: 'Effort, respect, resilience and being a great teammate.' },
    ],
  },
  sessions: {
    nav: 'Sessions',
    headline: 'Every session, five stages',
    body: 'Every session is built around one learning objective and follows the same five stages, so players get the most out of every minute.',
    more: 'Sessions run for 75 minutes for U5–U11 and 90 minutes for U12 and up.',
    lengths: '75 minutes for U5–U11 · 90 minutes for U12+',
    stages: [
      { name: 'IGNITE', line: 'A fun, high-energy start that switches players on to the session’s focus.' },
      { name: 'BUILD', line: 'Coaches break the skill down with clear demonstrations and lots of touches.' },
      { name: 'APPLY', line: 'Practise the skill under pressure, with opponents, decisions and constraints.' },
      { name: 'CONNECT', line: 'Link the skill to real match moments in small-sided games.' },
      { name: 'COMPETE', line: 'Finish with a game where using the objective helps you win.' },
    ],
  },
  reports: {
    nav: 'Reports',
    headline: 'Player reports you can follow',
    body: 'Once or twice a year, coaches assess each player against the curriculum’s achievement standards in every strand. Reports live on your child’s profile in the player portal, so you can see their progress over time.',
    more: 'Each strand is assessed on a five-point scale — Well below, Below, At, Above or Well above the standard for their level — with a short comment from the coach on what’s going well and what to work on next.',
  },
  year: {
    nav: 'Year-round',
    headline: 'A year-round program, four terms',
    body: 'We run all four Victorian school terms, so development doesn’t stop when the season does — around 80–100 training sessions a year.',
    more: 'In the off-season (Terms 1 and 4) players train twice a week with the Rowville Foundation Academy. In season (Terms 2 and 3) they train twice a week with their team and play weekly games, with an optional third academy session focused on their personal targets.',
    sessionsPerYear: '80–100 sessions a year',
    terms: [
      { term: 'Term 1', months: 'Late Jan – early Apr', title: 'Off-season', detail: 'Twice a week with the RFA academy' },
      { term: 'Term 2', months: 'Mid Apr – late Jun', title: 'Season', detail: 'Twice a week with your team + weekly games · optional RFA session' },
      { term: 'Term 3', months: 'Mid Jul – mid Sep', title: 'Season', detail: 'Twice a week with your team + weekly games · optional RFA session' },
      { term: 'Term 4', months: 'Early Oct – mid Dec', title: 'Off-season', detail: 'Twice a week with the RFA academy' },
    ],
  },
  pathways: {
    nav: 'Two pathways',
    headline: 'One club, two pathways',
    body: 'Players can be Rowville players in our club teams, Rowville Foundation Academy players, or both. Players from other clubs are welcome in the academy and stay connected to Rowville — and you can join part-way through the season through the academy, even when teams are full.',
    more: 'The academy and the club share the same curriculum and coaching approach, so moving between them — or doing both — is seamless.',
  },
  community: {
    nav: 'Community night',
    headline: 'Free Friday Community Night',
    body: 'Every Friday night is for families: a fun-only game, a free dinner, music and dessert. It’s our way of bringing back the community and culture we feel football has lost.',
    more: 'Dinner is usually pizza. There’s nothing to book — just rock up. We only ask that a parent or carer stays to supervise their child.',
    when: 'Fridays at 5:30pm during Victorian school terms (not school holidays)',
    where: 'Parkridge Reserve, 208 Dandelion Drive, Rowville VIC 3178',
    welcome: 'All welcome',
  },
  fplus: {
    nav: 'Foundation+',
    headline: 'Foundation+: training that keeps going at home',
    body: 'Our online training platform: levelled drills in six areas, video challenges checked by Academy coaches, badges and leaderboards.',
  },
  cta: {
    headline: 'Come and see the difference',
    body: 'Book into the academy, register interest for a team, or start a free month of Foundation+.',
  },
} as const

export type DifferenceContent = typeof DIFFERENCE
