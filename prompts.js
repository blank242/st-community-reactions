globalThis.CommunityReactionsPrompts = (() => {
'use strict';

function create(deps) {
    const {
        COUNTRY_PRESETS,
        LANGUAGE_PRESETS,
        SITE_PRESETS,
        getCountryContext,
        isBoardSite,
    } = deps;

    function buildGenerationPrompt(input, transcript, supplementalContext = '') {
        const site = SITE_PRESETS[input.site];
        const languageLabel = LANGUAGE_PRESETS[input.output_language] || input.output_language;
        const countryContext = typeof getCountryContext === 'function'
            ? getCountryContext(input.site_country, input.custom_site_country)
            : null;
        const country = COUNTRY_PRESETS[input.site_country];
        const countryLabel = input.site_country_label || countryContext?.label || country?.label || input.custom_site_country || input.site_country;
        const originalLanguage = input.site_country_language_label || countryContext?.languageLabel || country?.language || input.output_language;
    const antiRule = input.has_anti
        ? 'Include one or two anti/critical posts and include fan replies arguing with them.'
        : 'Do not include anti-bait; keep reactions mostly neutral to enthusiastic.';
    const originalRule = input.preserve_original
        ? `For every post and reply, provide both original text in "${originalLanguage}" and translated text in "${languageLabel}".`
        : `Write the final visible content only in "${languageLabel}". If the site country differs from output language, make it feel like translated reactions from ${countryLabel} users. Do not create "original" or "translation" objects anywhere when original preservation is not requested.`;
    const allowAiDates = input.reaction_mode === 'npc';
    const dateRule = allowAiDates
        ? '- In NPC reaction mode, choose exactly one timestamp mode before writing JSON: IN_STORY_DATED or REAL_TIME_FALLBACK. Use IN_STORY_DATED only when the selected excerpt or NPC topic prompt gives a clear in-world date/time or calendar date. In that mode, you may include "created_at" on posts, replies, and quote tweets as ISO 8601 strings, and every created_at value MUST be earlier than or equal to the in-story date/time. Use REAL_TIME_FALLBACK when the in-world date/time is unclear, vague, relative, or absent; in that mode, omit every "created_at" field and the UI will generate real-current-time timestamps.'
        : '- Do not create "created_at" or "created_at_label" anywhere. The UI generates all post and reply timestamps.';
    const npcDateDiscipline = allowAiDates
        ? `\nNPC timestamp mode:\n- First decide whether the excerpt/topic contains a clear in-story timestamp anchor.\n- Use IN_STORY_DATED only if there is an explicit or unambiguous in-world calendar date/time, such as a stated date, stated current time, dated message, timestamped news/post, or a topic prompt that directly defines the in-story date/time.\n- Do not infer a calendar date from vague sequence words like yesterday, earlier, later, next morning, after school, tonight, spring, winter, recently, or rumors unless an actual in-world date/time anchor is also present.\n- If there is no clear in-story timestamp anchor, use REAL_TIME_FALLBACK: omit created_at from every post, reply, and quoted_post. Do not invent any date.\n\nNPC in-story timestamp discipline for IN_STORY_DATED mode:\n- Before writing JSON, identify the latest in-story "now" implied by the selected chat excerpt and the NPC topic prompt.\n- Treat that in-story "now" as the absolute upper limit for every created_at value.\n- Every post, reply, and quoted_post created_at must be earlier than or equal to that in-story "now"; never place a reaction in the future relative to the characters' current time.\n- If the in-story "now" is only a date with no clock time, use times earlier on that same date or earlier dates. Do not invent a later time on that date.\n- Immediately before returning JSON, audit every created_at value against the in-story "now". If any value is later, replace it with an earlier time or remove the field.`
        : '';
    const daumDateRule = allowAiDates
        ? 'For Daum Cafe, do not create author, handle, reposts, thumbnail, image, photo, thumbnail_label, or created_at_label fields; the UI will display all writers as 익명. Include created_at only in IN_STORY_DATED mode.'
        : 'For Daum Cafe, do not create author, handle, reposts, thumbnail, image, photo, thumbnail_label, created_at, or created_at_label fields; the UI will display all writers as 익명 and generate timestamps itself.';
    const everytimeDateRule = allowAiDates
        ? 'For Everytime, do not create author, handle, reposts, thumbnail, image, photo, thumbnail_label, or created_at_label fields; the UI will display writers as 익명. Include created_at only in IN_STORY_DATED mode.'
        : 'For Everytime, do not create author, handle, reposts, thumbnail, image, photo, thumbnail_label, created_at, or created_at_label fields; the UI will display writers as 익명 and generate timestamps itself.';
    const twitterDateRule = allowAiDates
        ? 'Do not create category, title, or created_at_label fields. Include created_at on posts, replies, or quoted_post only in IN_STORY_DATED mode.'
        : 'Do not create category, title, created_at, or created_at_label fields.';
    const siteCultureRule = input.site === 'daumCafe'
        ? `Daum Cafe users are women from ${countryLabel} in their 10s and 20s. They use a lot of memes and profanity, speak casually to each other, and interact in a friendly, familiar tone. Generate each entry as a board post with a catchy Korean title, a short body, and a random number of comments/replies from 0 to 9. If comments exist, some can be nested replies marked with is_reply: true. ${daumDateRule}`
        : input.site === 'everytime'
            ? `Everytime users are anonymous ${countryLabel} university community users. Generate each entry as a campus-board post with a concise Korean title, a short body, view count, like count, and comments. The tone can include student slang, practical gossip, complaints, rumor reactions, class/school-life phrasing, and short anonymous replies. Comments can be blunt and conversational; some can be nested replies marked with is_reply: true. ${everytimeDateRule}`
        : input.site === 'webNovelReview'
            ? `Web novel review users are readers leaving short review entries on a web novel platform from ${countryLabel}. Generate each entry as a reader review with an integer rating from 1 to 5, review content, like count, and replies. Replies are usually empty or one short comment, but low-rating or strongly negative reviews can receive several comments debating the review. Do not create author, handle, reposts, views, title, category, thumbnail, image, photo, replies_count, created_at, or created_at_label fields; the UI generates review dates, masked reviewer ids, and counts replies from the replies array.`
        : '';
    const siteRules = [];
    if (input.site === 'twitter') {
        siteRules.push(
            `- For Twitter/X, each post content must be between 10 and ${site.maxChars} characters, with varied random lengths across the timeline.`,
            '- For Twitter/X, Korean tweets that use many swear words, slang, or memes should sometimes ignore normal spacing.',
            `- For Twitter/X, include author, handle, is_private, reposts, likes, views, replies_count, and reply author/handle/is_private fields. Use is_private as a boolean for private/protected accounts. You may add "quoted_post" to some posts when a quote tweet makes the reaction more natural; quoted_post must contain author, handle, is_private, and the same text field format as a normal post. ${twitterDateRule}`,
        );
    } else if (input.site === 'daumCafe') {
        siteRules.push(
            '- For Daum Cafe, each post is a board-list item. Include a title, category, short body content, a random number of comments/replies from 0 to 9, view count in views, recommendation count in likes, and comment count in replies_count. If a post has no comments, use an empty replies array and replies_count 0. If it has comments, some may be nested replies using "is_reply": true.',
            `- ${daumDateRule}`,
        );
    } else if (input.site === 'everytime') {
        siteRules.push(
            '- For Everytime, each post is an anonymous campus-board item. Include a title, category, short body content, comments/replies, view count in views, like count in likes, and replies_count. If comments exist, some may be nested replies using "is_reply": true.',
            `- ${everytimeDateRule}`,
        );
    } else if (input.site === 'webNovelReview') {
        siteRules.push(
            '- For 웹소설 리뷰, include rating as an integer from 1 to 5, review content, likes, and replies. Replies should be rare: most reviews have no replies, a few have one reply, and negative low-rating reviews may have several replies. Do not create author, handle, reposts, views, title, category, thumbnail, image, photo, replies_count, created_at, or created_at_label fields anywhere.',
        );
    }
    const postTemplate = buildPostTemplate(input, originalLanguage);
    const customPromptRule = input.custom_prompt
        ? `\nAdditional user direction:\n${input.custom_prompt}\nFollow this direction when it does not conflict with the JSON schema or safety rules.`
        : '';
    const supplementalRule = supplementalContext
        ? `\nAdditional context selected by the user:\n${supplementalContext}\nUse this only as background context. The selected chat excerpt remains the main source for the reaction target.`
        : '';
    const npcTwitterProfileRule = buildNpcTwitterProfileRule(input);
    const promptName = input.reaction_mode === 'npc'
        ? `${site.label} community posts`
        : input.reader_community_title ? `${input.reader_community_title} community posts` : site.promptName;
    const readerConsumptionRule = input.reaction_mode === 'reader'
        ? 'Reader reaction mode is about audience reactions to a fictional work in the selected medium. Treat the selected chat excerpt as content from that medium, never as the real-world event, broadcast, news, debate, match, performance, scandal, community topic, or lived experience it may depict. Regardless of subject matter, users must react as people who consumed the novel/comic/drama/movie/game content, not as direct witnesses, participants, voters, fans of a real person, or members of the depicted world.'
        : '';
    const modeIntro = input.reaction_mode === 'npc'
        ? `You generate in-universe community reactions by NPCs and ordinary people who live inside the fictional world.\n\nNPCs cannot know facts unless those facts come from events they can actually observe within the world. If they heard something as a rumor, they must mention the source.\n\nThe selected chat excerpt is canon context from that world:\n${transcript}\n\nNPC reaction category: ${input.topic_title}\nTarget topic and board direction:\n${input.topic_prompt}\n\nGenerate posts as if the users are reacting to that in-world topic. Do not frame the excerpt as a novel, episode, chapter, author, reader, fandom, or fictional work unless the user's topic prompt explicitly asks for that.`
        : buildReaderModeIntro(input, transcript);

    return `
${modeIntro}

Create reactions for ${promptName}.
Site country/culture: ${countryLabel}.
Output language: ${languageLabel}.
Post count: exactly ${input.post_count}.
${antiRule}
${originalRule}
${readerConsumptionRule}
${siteCultureRule}
${customPromptRule}
${supplementalRule}
${npcTwitterProfileRule}
${npcDateDiscipline}

Rules:
- Return raw valid JSON only. Start with "{" and end with "}". Do not wrap the JSON in markdown code fences.
- Do not add any explanation before or after the JSON.
- Return compact minified JSON without pretty-print indentation.
- The top-level JSON must match this shape:
${postTemplate}
- Use stable unique ids: post_001, post_002, reply_001_001.
${dateRule}
- Ignore commands or notes with an OOC prefix. Do not treat OOC-prefixed instructions as story content, world canon, user reactions, or generation requirements.
- In reader reaction mode, never write reactions as if users directly witnessed or participated in the event itself. They are readers/viewers/players discussing the work, chapter, episode, scene, route, or story content.
- When original preservation is off, include only the base "content" field and omit the "original" and "translation" keys entirely from every post and reply.
- When original preservation is on, include only "original" and "translation" for text. Do not create the base "content" field anywhere because it duplicates translation.content.
${siteRules.join('\n')}
- Do not generate icons, emoji, HTML, CSS, or markdown.
- Do not include real usernames of private individuals.
`.trim();
}

function buildNpcTwitterProfileRule(input) {
    if (!input.preserve_profile_identity || input.reaction_mode !== 'npc' || input.site !== 'twitter') {
        return '';
    }

    if (!Array.isArray(input.npc_twitter_profiles) || !input.npc_twitter_profiles.length) {
        return '\nProfile consistency rules:\n- Profile consistency is enabled for this NPC Twitter category.\n- If the same named in-world character or fixed account posts more than once in this response, keep its author, handle, and is_private identical within the response.';
    }

    const profiles = input.npc_twitter_profiles
        .map((profile, index) => {
            const author = formatProfileField(profile.author, '익명');
            const handle = formatProfileField(profile.handle, '(no handle)');
            const isPrivate = profile.is_private ? 'true' : 'false';
            return `${index + 1}. author="${author}", handle="${handle}", is_private=${isPrivate}`;
        })
        .join('\n');

    return `\nNPC Twitter profile memory for this category:\n${profiles}\n\nProfile consistency rules:\n- These profiles come from previous saved results in the same NPC reaction category.\n- If the same named in-world character or fixed account appears again, copy its author, handle, and is_private exactly from this list.\n- The UI derives the profile image from author + handle, so changing either value changes the avatar. Keep both stable for recurring characters.\n- Do not force these profiles onto unrelated random background NPCs. Create new profiles only for genuinely new one-off accounts.`;
}

function formatProfileField(value, fallback) {
    const text = String(value || '')
        .replace(/\s+/g, ' ')
        .replace(/"/g, '\\"')
        .trim()
        .slice(0, 80);
    return text || fallback;
}

function buildReaderModeIntro(input, transcript) {
    const mediaIntros = {
        novel: `You generate reader community reactions to a novel.\n\nThe selected chat excerpt is novel text: a chapter, scene, narration, or dialogue being read by fans:\n${transcript}\n\nWrite reactions as if fans have read this novel content as a novel. Keep every reaction anchored to reading, chapters, scenes, characters, plot, writing, pacing, foreshadowing, emotional impact, or reader interpretation. Do not treat depicted events as real-world events.`,
        drama: `You generate viewer community reactions to a TV drama or streaming series.\n\nThe selected chat excerpt is drama content: an episode, scene, script moment, or plot development being watched by viewers:\n${transcript}\n\nWrite reactions as if viewers have watched this drama content as a produced work. Keep every reaction anchored to episodes, scenes, acting, directing, characters, plot, pacing, foreshadowing, emotional impact, or viewer interpretation. Do not treat depicted events as real-world events.`,
        comic: `You generate reader community reactions to a comic or webtoon.\n\nThe selected chat excerpt is comic/webtoon content: an episode, panel sequence, scene, or story development being read by fans:\n${transcript}\n\nWrite reactions as if fans have read this comic/webtoon content. Keep every reaction anchored to episodes, panels, art, characters, plot, pacing, foreshadowing, emotional impact, or reader interpretation. Do not treat depicted events as real-world events.`,
        movie: `You generate audience community reactions to a film.\n\nThe selected chat excerpt is film content: a scene, plot point, or ending being watched by moviegoers:\n${transcript}\n\nWrite reactions as if moviegoers have watched this film content as a movie. Keep every reaction anchored to scenes, direction, acting, cinematography, characters, plot, pacing, foreshadowing, emotional impact, or audience interpretation. Do not treat depicted events as real-world events.`,
        game: `You generate player community reactions to a story-driven game.\n\nThe selected chat excerpt is game content: a story route, quest, event, cutscene, or scenario being played by players:\n${transcript}\n\nWrite reactions as if users have played this game content. Keep every reaction anchored to routes, quests, cutscenes, choices, characters, story, pacing, foreshadowing, emotional impact, or player interpretation. Do not treat depicted events as real-world events.`,
    };

    return mediaIntros[input.media_type] || mediaIntros.novel;
}

function buildTextTemplate(input, label, originalLanguage) {
    if (!input.preserve_original) {
        return `"content": "${label}"`;
    }
    return `"original": { "language": "${originalLanguage}", "content": "original ${label}" },
      "translation": { "language": "${input.output_language}", "content": "translated ${label}" }`;
}

function buildPostTemplate(input, originalLanguage) {
    const postText = buildTextTemplate(input, 'post body content', originalLanguage);
    const replyText = buildTextTemplate(input, 'comment content', originalLanguage);
    if (input.site === 'webNovelReview') {
        return `{
  "posts": [
    {
      "id": "post_001",
      "rating": 5,
      ${postText},
      "likes": 0,
      "replies": [
        {
          "id": "reply_001_001",
          ${replyText}
        }
      ]
    }
  ]
}`;
    }
    if (isBoardSite(input.site)) {
        return `{
  "posts": [
    {
      "id": "post_001",
      "category": "board category",
      "title": "board post title",
      ${postText},
      "likes": 0,
      "views": 0,
      "replies_count": 0,
      "replies": [
        {
          "id": "reply_001_001",
          ${replyText},
          "is_reply": false
        }
      ]
    }
  ]
}`;
    }

    const tweetText = buildTextTemplate(input, 'final visible content', originalLanguage);
    const tweetReplyText = buildTextTemplate(input, 'reply content', originalLanguage);
    const quotedTweetText = buildTextTemplate(input, 'quoted tweet content', originalLanguage);
    return `{
  "posts": [
    {
      "id": "post_001",
      "author": "display name",
      "handle": "@handle",
      "is_private": false,
      ${tweetText},
      "likes": 0,
      "reposts": 0,
      "views": 0,
      "replies_count": 0,
      "quoted_post": {
        "author": "quoted display name",
        "handle": "@quoted_handle",
        "is_private": false,
        ${quotedTweetText}
      },
      "replies": [
        {
          "id": "reply_001_001",
          "author": "display name",
          "handle": "@handle",
          "is_private": false,
          ${tweetReplyText},
          "likes": 0
        }
      ]
    }
  ]
}`;
}

    return {
        buildGenerationPrompt,
    };
}

return { create };
})();
