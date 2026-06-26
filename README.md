# Community Reactions

<p>
  <a href="#한국어"><strong>한국어</strong></a>
  &nbsp;|&nbsp;
  <a href="#english"><strong>English</strong></a>
</p>

## 한국어

SillyTavern 채팅 내용을 바탕으로 가상의 커뮤니티 반응을 생성하고 볼 수 있는 확장입니다.

선택한 채팅 구간을 소설의 한 장면, 드라마 에피소드, 웹툰 회차, 영화 장면, 게임 이벤트처럼 취급한 뒤 Twitter/X, 카페, 에브리타임, 웹소설 리뷰 페이지 같은 형태의 반응을 생성합니다.

### 주요 기능

- 채팅 내용을 기반으로 커뮤니티 반응 생성
- 독자 반응과 작중 NPC 반응 지원
- Twitter/X 스타일 타임라인
- Daum Cafe 스타일 게시판
- 에브리타임 스타일 익명 게시판
- 웹소설 리뷰 스타일
- 커스텀 커뮤니티와 NPC 반응 카테고리 저장
- 월드인포, 캐릭터 카드, 숨김 메시지를 선택적으로 포함
- 원문 보존 옵션 지원
- 생성된 게시글 선택 삭제 및 현재 카테고리 전체 삭제

### 사용 방법

1. SillyTavern에서 채팅을 엽니다.
2. 마법봉 메뉴에서 `커뮤니티 보기`를 누릅니다.
3. `반응 유형`을 선택합니다.
4. 커뮤니티, 메시지 범위, 국가, 출력 언어, 게시글 수 등을 설정합니다.
5. 필요하다면 월드인포, 캐릭터 카드, 안티반응, 원문보존 옵션을 켭니다.
6. `생성하기`를 누릅니다.
7. 생성이 끝나면 `커뮤니티 보기`에서 저장된 반응을 확인합니다.

### 반응 유형

#### 독자 반응

선택한 채팅 구간을 작품 내용으로 보고 반응을 생성합니다.

`원작 매체`에서 소설, 드라마, 만화, 영화, 게임 중 하나를 고르면 AI가 그 매체를 소비한 사람들의 반응처럼 작성합니다.

예를 들어 원작 매체가 `소설`이면 사용자는 실제 사건을 본 사람이 아니라 소설의 장면을 읽은 독자처럼 반응해야 합니다.

#### 작중 NPC 반응

선택한 채팅 구간을 작품 속 세계의 실제 사건처럼 보고, 그 세계 안의 인터넷 이용자들이 반응하는 형태로 생성합니다.

NPC 반응은 별도의 카테고리 제목과 프롬프트를 저장해서 사용할 수 있습니다.

### 커뮤니티와 카테고리

#### 커스텀 커뮤니티

독자 반응에서 기본 커뮤니티 외에 직접 커뮤니티를 추가할 수 있습니다.

```text
커뮤니티 제목: 야구팬 타임라인
기본 커뮤니티: Twitter
커뮤니티 프롬프트:
- 야구를 좋아하는 유저들이 모인 타임라인
- 말투는 가볍고 드립이 많음
```

#### NPC 반응 카테고리

작중 NPC 반응에서 사용할 게시판 성격을 저장할 수 있습니다.

```text
카테고리 제목: 마법학교 익명 게시판
대상 게시판: 에브리타임
카테고리 프롬프트:
학생들이 방금 일어난 사건에 대해 익명으로 떠드는 게시판
```

### 옵션 설명

- `메시지 범위`: 반응 생성에 사용할 채팅 구간입니다.
- `국가`: 커뮤니티 유저들의 문화권과 말투 기준입니다.
- `출력 언어`: 최종 반응이 출력될 언어입니다.
- `연결 프로필`: 현재 Main API 또는 Connection Profile을 선택합니다.
- `답변 최대 토큰 수`: 생성 요청에 사용할 최대 토큰 수입니다.
- `게시글 수`: 생성할 게시글 수입니다.
- `숨김 메시지 포함`: 시스템/숨김 메시지를 반응 생성에 포함합니다.
- `월드인포 포함`: 활성 월드인포를 추가 배경으로 포함합니다.
- `캐릭터카드 포함`: 현재 캐릭터 카드 정보를 추가 배경으로 포함합니다.
- `안티반응포함`: 비판적이거나 부정적인 반응을 일부 포함합니다.
- `원문보존`: 출력 언어와 커뮤니티 국가 언어가 다를 때 원문과 번역을 함께 생성합니다.
- `커스텀 프롬프트`: 말투, 커뮤니티 성향, 반응 방향을 추가로 지시합니다.

### 저장 방식

생성 결과는 SillyTavern의 user files 영역에 JSON 파일로 저장됩니다.

파일명은 `crx__...json` 형태입니다. 서버 패치 없이 기본 SillyTavern 파일 업로드 API를 사용합니다.

### 삭제

뷰어에서 휴지통 버튼을 누르면 삭제 모드가 켜집니다.

- `선택 삭제`: 체크한 게시글만 삭제합니다.
- `전체 삭제`: 현재 선택된 커뮤니티 또는 카테고리의 저장 결과를 모두 삭제합니다.

커스텀 커뮤니티나 NPC 카테고리를 삭제하면 해당 커뮤니티/카테고리로 생성한 반응도 함께 삭제됩니다.

### 주의사항

- AI 출력은 반드시 JSON이어야 하므로, 모델이 JSON 형식을 지키지 못하면 생성이 실패할 수 있습니다.
- 실패한 원본 응답은 디버깅용 JSON 파일로 저장됩니다.
- 월드인포와 캐릭터 카드를 포함하면 더 많은 토큰을 사용할 수 있습니다.
- 원문보존은 원문과 번역을 모두 생성하므로 토큰 사용량이 크게 늘어날 수 있습니다.
- 이 확장은 AI가 만든 HTML을 사용하지 않습니다. 생성 결과는 JSON으로 저장되고 확장 내부 렌더러가 화면에 표시합니다.

### 문제 해결

#### 마법봉 메뉴에 `커뮤니티 보기`가 보이지 않아요

SillyTavern을 새로고침하세요. 그래도 보이지 않으면 브라우저 콘솔에 `Community Reactions` 관련 오류가 있는지 확인하세요.

#### 생성이 실패해요

다음 항목을 확인하세요.

- 현재 Main API 또는 선택한 Connection Profile이 정상 동작하는지
- 답변 최대 토큰 수가 너무 낮지 않은지
- 모델이 JSON만 출력하도록 잘 따르는지
- 실패 응답 파일이 `/user/files/crx__failed__...json` 형태로 저장되었는지

#### 반응이 원하는 커뮤니티 분위기와 달라요

커스텀 프롬프트에 커뮤니티 성격, 말투, 금지할 방향을 더 구체적으로 적어보세요.

```text
- 실제 사건처럼 반응하지 말고 소설 독자들이 장면을 읽은 반응으로 작성
- 과몰입 독자, 분석하는 독자, 드립 치는 독자를 섞기
- 너무 설명식으로 쓰지 말고 짧은 커뮤니티 말투로 작성
```

---

## English

Community Reactions is a SillyTavern extension that generates fictional community reactions from your chat content.

It can treat the selected chat range as a novel chapter, drama episode, comic/webtoon update, movie scene, or game event, then render reactions in styles such as Twitter/X, cafe boards, anonymous campus boards, or web novel reviews.

### Features

- Generate community reactions from chat content
- Reader reaction mode and in-world NPC reaction mode
- Twitter/X-style timeline
- Daum Cafe-style board
- Everytime-style anonymous board
- Web novel review-style page
- Saved custom reader communities and NPC reaction categories
- Optional world info, character card, and hidden message context
- Original text preservation option
- Delete selected posts or all saved results for the current community/category

### Basic Usage

1. Open a chat in SillyTavern.
2. Click `커뮤니티 보기` in the wand menu.
3. Choose a reaction type.
4. Select a community, message range, country, output language, and post count.
5. Optionally include world info, character card, anti reactions, hidden messages, or original text preservation.
6. Click `생성하기`.
7. Open the viewer with `커뮤니티 보기` to browse saved reactions.

### Reaction Types

#### Reader Reactions

Reader reactions treat the selected chat range as content from a fictional work.

Use `Original Medium` to choose whether the chat should be treated as a novel, drama, comic, movie, or game. The generated users should react as people who consumed that medium.

For example, if the medium is `novel`, users should react as readers who read a novel scene, not as people directly witnessing a real event.

#### In-World NPC Reactions

NPC reactions treat the selected chat range as a real event inside the fictional world.

You can save separate category titles and prompts for different in-world boards or communities.

### Communities and Categories

#### Custom Reader Communities

In reader reaction mode, you can add your own custom communities.

```text
Community title: Baseball fan timeline
Base community: Twitter
Community prompt:
- A timeline full of baseball fans
- Casual tone with many jokes and memes
```

#### NPC Reaction Categories

In NPC reaction mode, you can save the board style and topic direction.

```text
Category title: Magic school anonymous board
Target board: Everytime
Category prompt:
An anonymous board where students discuss the incident that just happened
```

### Options

- `Message range`: The chat messages used as the reaction target.
- `Country`: The cultural tone of the community users.
- `Output language`: The final language of generated reactions.
- `Connection Profile`: Use the current Main API or a selected Connection Profile.
- `Max tokens`: Maximum response length for generation.
- `Post count`: Number of posts to generate.
- `Include hidden messages`: Include hidden/system messages in the source context.
- `Include world info`: Add activated world info as background context.
- `Include character card`: Add current character card details as background context.
- `Include anti reactions`: Include some critical or negative reactions.
- `Preserve original`: Generate both original text and translation when the community language differs from the output language.
- `Custom prompt`: Add extra direction for tone, community behavior, or reaction style.

### Storage

Generated results are saved as JSON files in SillyTavern's user files area.

Files use the `crx__...json` naming pattern. The extension uses SillyTavern's default file upload API and does not require server patches.

### Deleting Results

Click the trash button in the viewer to enter delete mode.

- `선택 삭제`: Delete only checked posts.
- `전체 삭제`: Delete all saved results for the currently selected community/category.

Deleting a custom community or NPC category also deletes reactions generated under that community/category.

### Notes

- The model must return valid JSON. If it does not, generation may fail.
- Failed raw responses are saved as debugging JSON files.
- Including world info and character cards can increase token usage.
- Original preservation can greatly increase token usage because both original and translated text are generated.
- The extension does not use AI-generated HTML. The model outputs JSON, and the extension's renderer displays it.

### Troubleshooting

#### I do not see `커뮤니티 보기` in the wand menu

Refresh SillyTavern. If it still does not appear, check the browser console for `Community Reactions` errors.

#### Generation fails

Check the following:

- Your current Main API or selected Connection Profile works
- Max tokens is not too low
- The model can follow JSON-only output instructions
- A failed response file was saved as `/user/files/crx__failed__...json`

#### The reactions do not match the community tone I wanted

Use the custom prompt field to describe tone, community behavior, and what to avoid.

```text
- Do not react as if this happened in real life; write as readers discussing a novel scene
- Mix immersive readers, analysis-heavy readers, and meme/joke replies
- Avoid long explanations; use short community-style posts
```

