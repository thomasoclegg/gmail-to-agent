// The made-up mailbox the recordings use. Nothing here is real: the names, addresses, orders and dates
// are invented, and every address uses example.com. The stage page builds its inbox and thread view
// from this, and record.mjs builds Gmail's print views (for several selected emails) from it too.

(function (root) {
  const ME = { name: 'Sam Morgan', email: 'sam.morgan@example.com' };

  // Newest first, as Gmail lists them. ids are 16 hex digits, like Gmail's data-legacy-thread-id. Six start
  // unread; the walkthrough opens two of them, and Triage unread hands over the other four.
  const THREADS = [
    {
      id: '19a4c2e81f07b3d5',
      key: 'lease',
      from: 'Marta Ioannou, me',
      subject: 'Lease renewal for flat 4B',
      snippet: 'Thanks Marta. Is the 4% fixed for the whole year?',
      when: '18:40',
      unread: false,
      messages: [
        {
          name: 'Marta Ioannou',
          email: 'marta.ioannou@example.com',
          to: ME.email,
          date: 'Wed, 4 Nov 2026, 09:14',
          body: 'Hi Sam,\n\nThe new terms for flat 4B are attached. The rent goes up 4% from January and the notice period becomes two months.\n\nCan you let me know by Friday whether you want to renew?\n\nMarta',
        },
        {
          name: ME.name,
          email: ME.email,
          to: 'marta.ioannou@example.com',
          date: 'Wed, 4 Nov 2026, 18:40',
          body: 'Thanks Marta. Is the 4% fixed for the whole year?\n\nSam',
        },
      ],
    },
    {
      id: '19a4a1f36e2d8c47',
      key: 'order',
      from: 'me, Priya Shah',
      subject: 'Delivery date for order 1042',
      snippet: 'Good news: your two oak shelves are ready. We can deliver on',
      when: '17:20',
      unread: true,
      messages: [
        {
          name: ME.name,
          email: ME.email,
          to: 'priya.shah@example.com',
          date: 'Mon, 2 Nov 2026, 17:05',
          body: 'Hi Priya,\n\nAny news on order 1042? I\'m away from the 16th, so it would help to have it before then.\n\nThanks,\nSam',
        },
        {
          name: 'Priya Shah',
          email: 'priya.shah@example.com',
          to: ME.email,
          date: 'Wed, 4 Nov 2026, 17:20',
          body: 'Hi Sam,\n\nGood news: your two oak shelves are ready. We can deliver on Thursday 12 November between 8 and 12, or on Saturday 14 November between 10 and 2. Which suits you better?\n\nIf neither works, tell me a day that does and I\'ll check with the driver.\n\nBest wishes,\nPriya',
        },
      ],
    },
    {
      id: '19a4b7d20c5e9a61',
      key: 'boat',
      from: 'Andreas K.',
      subject: 'Boat on Saturday?',
      snippet: 'Forecast says 18 knots, so maybe Sunday instead',
      when: '16:05',
      unread: true,
      messages: [
        { name: 'Andreas K.', email: 'andreas.k@example.com', to: ME.email, date: 'Wed, 4 Nov 2026, 16:05', body: 'Forecast says 18 knots, so maybe Sunday instead. Still up for it?\n\nA.' },
      ],
    },
    {
      id: '19a48e5b7a1c0f92',
      key: 'books',
      from: 'Book club',
      subject: 'December pick',
      snippet: "We're down to two. Vote by Friday",
      when: '3 Nov',
      unread: true,
      messages: [{ name: 'Book club', email: 'bookclub@example.com', to: ME.email, date: 'Tue, 3 Nov 2026, 20:12', body: "We're down to two. Vote by Friday." }],
    },
    {
      id: '19a47c09d3b6e215',
      key: 'school',
      from: 'Hannah Kim',
      subject: 'School trip consent form',
      snippet: 'Please sign and return it by Thursday',
      when: '3 Nov',
      unread: true,
      messages: [{ name: 'Hannah Kim', email: 'hannah.kim@example.com', to: ME.email, date: 'Tue, 3 Nov 2026, 08:47', body: 'Please sign and return it by Thursday.\n\nHannah' }],
    },
    {
      id: '19a46a2f85c1d7e3',
      key: 'boiler',
      from: 'Chris Walker',
      subject: 'Boiler service booked',
      snippet: 'The engineer can come on Tuesday between 9 and 12',
      when: '2 Nov',
      unread: false,
      messages: [
        {
          name: 'Chris Walker',
          email: 'chris.walker@example.com',
          to: ME.email,
          date: 'Mon, 2 Nov 2026, 10:02',
          body: 'Hi Sam,\n\nThe engineer can come on Tuesday between 9 and 12 for the annual boiler service. Reply to confirm, or suggest another morning next week.\n\nChris',
        },
      ],
    },
    {
      id: '19a45b4e1d9f6a08',
      key: 'bath',
      from: 'Dimitris P.',
      subject: 'Quote for the bathroom',
      snippet: 'Labour is now split into two stages',
      when: '1 Nov',
      unread: false,
      messages: [{ name: 'Dimitris P.', email: 'dimitris.p@example.com', to: ME.email, date: 'Sun, 1 Nov 2026, 12:30', body: 'Labour is now split into two stages.' }],
    },
    {
      id: '19a449c7f2e0b5d1',
      key: 'tickets',
      from: 'Nadia Haddad',
      subject: 'Tickets for the 22nd',
      snippet: "I've got two spares if you still want them",
      when: '31 Oct',
      unread: true,
      messages: [{ name: 'Nadia Haddad', email: 'nadia.haddad@example.com', to: ME.email, date: 'Sat, 31 Oct 2026, 19:55', body: "I've got two spares if you still want them." }],
    },
    {
      id: '19a438b06c4a2e7f',
      key: 'garden',
      from: 'Lena Fischer',
      subject: 'Allotment rota',
      snippet: 'Your weeks are the 9th and the 23rd',
      when: '30 Oct',
      unread: true,
      messages: [{ name: 'Lena Fischer', email: 'lena.fischer@example.com', to: ME.email, date: 'Fri, 30 Oct 2026, 07:41', body: 'Your weeks are the 9th and the 23rd.' }],
    },
  ];

  root.STAGE_DATA = { ME, THREADS, IK: 'q7Rk2mX9vT', INBOX_COUNT: '1–50 of 1,284' };
})(typeof window === 'undefined' ? globalThis : window);
