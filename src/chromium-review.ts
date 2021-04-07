import fetch from 'node-fetch';

export async function handleChromiumReviewUnfurl(url: string, message_ts: string, channel: string) {
  const match = /^https:\/\/chromium-review\.googlesource\.com\/c\/([a-z0-9]+)\/([a-z0-9]+)\/\+\/([0-9]+)/g.exec(
    url,
  );
  if (match) {
    const repo = `${match[1]}%2F${match[2]}`;
    const niceRepo = `${match[1]}/${match[2]}`;
    const cl = parseInt(match[3], 10);

    const detailsUrl = `https://chromium-review.googlesource.com/changes/${repo}~${cl}/detail?O=916314`;
    const detailsResponse = await fetch(detailsUrl);
    const detailsText = await detailsResponse.text();
    const details = JSON.parse(detailsText.substr(4));
    const { project, subject, owner, labels, current_revision, revisions } = details;
    const commit = revisions[current_revision].commit;
    const {
      message,
      author: { date },
    } = commit;
    const messageWithoutSubject = message.startsWith(subject)
      ? message.substr(subject.length + 1).trim()
      : message;

    const unfurl = await fetch('https://slack.com/api/chat.unfurl', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.SLACK_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        // token: '',
        channel,
        ts: message_ts,
        unfurls: {
          [url]: {
            color: '#4D394B',
            author_name: owner.name,
            author_icon:
              owner.avatars && owner.avatars.length
                ? owner.avatars[owner.avatars.length - 1].url
                : ':void',
            author_link: `https://chromium-review.googlesource.com/q/author:${encodeURIComponent(
              owner.email,
            )}`,
            fallback: `[${niceRepo}] #${cl} ${subject}`,
            title: `#${cl} ${subject}`,
            title_link: url,
            footer_icon: 'https://chromium-review.googlesource.com/favicon.ico',
            text: messageWithoutSubject,
            footer: `<https://source.chromium.org/chromium/${niceRepo}|${niceRepo}>`,
            ts: new Date(date).getTime(),
            // TODO: Labels? CQ status?
            // fields: [{

            // }]
          },
        },
      }),
    });
    if (unfurl.status === 200) {
      const resp = await unfurl.json();
      if (!resp.ok) {
        console.error('Failed to unfurl', resp);
      }
    }
    return true;
  }

  return false;
}