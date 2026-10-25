/* 소명지도 — 첫 화면 3입구, 입구 1(내 검사 결과로 찾기), 입구 2(직접 검색하기), 입구 3(특수학급·특수학교 찾기). 정적 사이트용 스크립트.
   데이터는 data/v2_js/ 의 래퍼(data/v2 JSON 과 같은 내용)만 <script> 로 읽는다. 외부 요청·저장·쿠키 없음(선택은 메모리에만 있고 새로고침하면 사라진다). */
"use strict";
(function () {
  const D = (window.CMDATA = window.CMDATA || {});
  const $app = document.getElementById("app");
  const $live = document.getElementById("live");

  /* ---------- 말(중학생도 이해하게) ---------- */
  const GIFT = { L: "리더십·조직", C: "돌봄·상담·자비", S: "섬김·봉사", W: "예배·예술", T: "가르침·지식", M: "전도·선교·사회", P: "기도·영성", R: "창의·혁신" };
  const GIFT_ORDER = ["C", "L", "M", "P", "R", "S", "T", "W"];
  const TYPES = ["ISTJ", "ISFJ", "INFJ", "INTJ", "ISTP", "ISFP", "INFP", "INTP", "ESTP", "ESFP", "ENFP", "ENTP", "ESTJ", "ESFJ", "ENFJ", "ENTJ"];
  const GROUP_LABEL = { christian_vocation: "기독교 사역 직업", emerging_new: "새로 생긴 직업", jobs_extra_recheck: "다시 살펴본 직업", pet_intl_existing: "반려·국제 분야 직업" };
  const GIFT_LINE = { L: "사람들을 이끌고 모임을 세우는 힘이에요.", C: "아픈 사람 곁에서 듣고 돌보는 힘이에요.", S: "필요한 곳에서 몸을 움직여 돕는 힘이에요.", W: "예배와 예술로 마음을 모으는 힘이에요.",
    T: "알게 된 것을 쉽게 풀어 가르치는 힘이에요.", M: "복음을 전하고 이웃과 사회에 다가가는 힘이에요.", P: "기도하며 하나님 앞에 머무르는 힘이에요.", R: "새로운 방법과 길을 만들어 내는 힘이에요." };
  const TILE_POS = { "서울": [1, 0], "인천": [0, 1], "경기": [1, 1], "강원": [2, 1], "충남": [0, 2], "세종": [1, 2], "충북": [2, 2], "경북": [3, 2], "전북": [0, 3], "대전": [1, 3], "대구": [2, 3], "울산": [3, 3],
    "광주": [0, 4], "전남": [1, 4], "경남": [2, 4], "부산": [3, 4], "제주": [0, 5] };
  const RANK_MEASURE = { univ_rank: "대학 순위", theology_rank: "신학대학 순위", pastor_output: "목회자 배출", missionary_output: "선교사 배출" };
  const RANK_TYPE = { public: "공공 자료", external_survey: "외부 조사", self_reported: "기관 자체 자료" };
  const UNDERGRAD = new Set(["학사", "전문학사", "학석사통합"]);
  const PAGE = 30;
  const TALENTROAD = "https://lgh5440.github.io/talentroad-test/";

  const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const collator = new Intl.Collator("ko");

  /* ---------- 자료 읽기 ---------- */
  const scriptP = {};
  const LOAD_TIMEOUT_MS = window.__CM_TIMEOUT_MS || 20000;                 // 자료가 20초 안에 안 오면 기다리지 않고 쉬운 오류 문구를 보인다(무한 로딩 금지). 느린 인터넷(Fast3G)에서도 샤드 1~2개는 받을 시간
  const BULK_TIMEOUT_MS = window.__CM_TIMEOUT_MS || 45000;                 // 대량 화면(학교 검색·특수학교/특수학급 목록)은 28샤드 5.2MB 를 한꺼번에 받는다 → Fast3G 에서 약 26초. 그래서 이 화면만 45초까지 기다린다(무한 금지·초과하면 같은 오류 화면과 '다시 시도')
  function loadScript(src, ms) {
    if (!scriptP[src]) {
      scriptP[src] = new Promise((resolve, reject) => {
        const s = document.createElement("script");
        const timer = setTimeout(() => { reject(new Error("timeout " + src)); }, ms || LOAD_TIMEOUT_MS);
        s.src = src; s.onload = () => { clearTimeout(timer); resolve(); }; s.onerror = () => { clearTimeout(timer); reject(new Error("load " + src)); };
        document.head.appendChild(s);
      }).catch(e => { delete scriptP[src]; throw e; });                    // 실패한 요청은 기억하지 않는다 → '다시 시도'가 새로 요청한다
    }
    return scriptP[src];
  }
  const jsName = rel => "data/v2_js/" + rel.replace(/\//g, "__") + ".js";
  async function file(rel, ms) { if (!D[rel]) await loadScript(jsName(rel), ms); return D[rel]; }
  async function shards(table, ms) {
    const m = D["manifest.json"].shards[table];
    const docs = await Promise.all(m.map(s => file(s.file, ms)));
    return docs.flatMap(d => d.rows);
  }
  const cache = {};
  async function once(key, fn) { if (!cache[key]) cache[key] = fn().catch(e => { delete cache[key]; throw e; }); return cache[key]; }

  const loadScope = () => once("scope", async () => {
    const [jobsDoc, scopeDoc, fieldsDoc] = await Promise.all([file("jobs.json"), file("type_scope.json"), file("fields.json")]);
    const jobs = jobsDoc.rows.map(r => ({ id: r[0], name: r[1], field: r[2], origin: r[3], group: r[4], linked: r[6] === "linked", majorCount: r[7], description: r[11] || "", wage: r[12] || "", sourceUrl: r[13] || "" }));
    const byId = new Map(jobs.map(j => [j.id, j]));
    const combos = new Map(scopeDoc.combos.map(c => [c.key, c]));
    const appears = new Map();                               // 직업 id → 소개된 조합 수
    scopeDoc.combos.forEach(c => c.job_ids.forEach(id => appears.set(id, (appears.get(id) || 0) + 1)));
    return { jobs, byId, combos, fields: fieldsDoc.fields, appears };
  });
  const univKind = (type, name) => {                              // 종류: dept=대학의 특수교육 학과 · college=전문대학(이름으로 확실한 곳만) · unsure=대학 계열(종류 확인 중) · univ=대학
    if (type === "special_ed_dept") return "dept";
    if (type === "college") return /전문대학교?$/.test(name) && !/대학교 |과학기술원|대학원/.test(name) ? "college" : "unsure";
    return "univ";
  };
  const UNIV_SUB = { dept: "대학의 특수교육 학과", college: "전문대학", unsure: "대학 계열(종류 확인 중)", univ: "대학" };
  const loadPaths = () => once("paths", async () => {
    const [jm, majors, ms, sc] = await Promise.all([shards("job_majors"), shards("majors_core"), shards("major_schools"), shards("schools_univ")]);
    const jobMajors = new Map(jm.map(r => [r[0], r[1]]));
    const majorById = new Map(majors.map(r => [r[0], { id: r[0], name: r[1] }]));
    const majorSchools = new Map(ms.map(r => [r[0], r[1]]));
    const schools = new Map(sc.map(r => [r[0], { idx: r[0], name: r[2], sido: r[4], code: r[1], type: r[3], chr: r[6] === true }]));
    const schoolMajors = new Map();                          // 학교 idx → Set(학과 id)
    for (const [mid, list] of majorSchools) for (const t of list) { if (!schoolMajors.has(t[0])) schoolMajors.set(t[0], new Set()); schoolMajors.get(t[0]).add(mid); }
    const degrees = D["manifest.json"].codes.degree;
    const majorJobs = new Map();                             // 학과 id → 직업 id 목록
    for (const [jid, ms] of jobMajors) for (const x of ms) { if (!majorJobs.has(x[0])) majorJobs.set(x[0], []); majorJobs.get(x[0]).push(jid); }
    return { jobMajors, majorById, majorSchools, schools, schoolMajors, majorJobs, degrees };
  });

  /* 지도 경계(통계청 SGIS 2020 단순화본, data/geo/PROVENANCE.md) — 못 읽으면 글자 버튼 지도만 보인다 */
  const GEO_SLUG = { "서울": "seoul", "부산": "busan", "대구": "daegu", "인천": "incheon", "광주": "gwangju", "대전": "daejeon", "울산": "ulsan", "세종": "sejong", "경기": "gyeonggi", "강원": "gangwon",
    "충북": "chungbuk", "충남": "chungnam", "전북": "jeonbuk", "전남": "jeonnam", "경북": "gyeongbuk", "경남": "gyeongnam", "제주": "jeju" };
  const GEO = { sido: null, sg: {} };
  async function loadGeo(sido) {
    try {
      if (!GEO.sido) GEO.sido = await file("geo_sido.json");
      const s = sidoOf(sido);
      if (s && GEO_SLUG[s] && !GEO.sg[s]) GEO.sg[s] = await file("geo_sigungu/" + GEO_SLUG[s] + ".json");
    } catch (e) { /* 경계 파일이 없으면 글자 버튼 지도만 보인다 */ }
  }

  /* 기독교 표시(확인된 것만 담긴 공개 파일)·순위자료 틀(값이 있을 때만 보임) */
  const loadChristian = () => once("chr", async () => {
    const d = await file("christian_public.json"), m = new Map(d.items.filter(i => i.code).map(i => [i.code, i]));
    const pa = await loadPaths(), bare = x => String(x || "").replace(/\(.*$/, "").replace(/\s/g, "");       // 코드가 비어 있는 학교는 학교 표의 이름과 글자가 똑같을 때만 연결한다
    const byName = new Map(); for (const s of pa.schools.values()) if (s.type !== "special_ed_dept" && !byName.has(bare(s.name))) byName.set(bare(s.name), s.code);
    m.byName = [];
    for (const i of d.items) { if (i.tier === "fcsk_list_only") continue;   // 명단 등재만 확인한 곳은 이름 접두로 학과·대학원에 근거를 퍼뜨리지 않는다
      const n = bare(i.name); m.byName.push([n, i]); if (!i.code && byName.has(n) && !m.has(byName.get(n))) m.set(byName.get(n), i); }
    return m;
  });
  const chrOf = (m, code, name) => {                                  // 학교 코드로 먼저, 없으면 '○○대학교 △△학과'처럼 이름이 기독교 대학 이름으로 시작할 때 그 대학의 근거를 쓴다
    if (m.get(code)) return m.get(code);
    const n = String(name || "").replace(/\s/g, ""); let best = null;
    for (const [b, i] of m.byName || []) if (b.length >= 4 && n.startsWith(b) && (!best || b.length > best[0].length)) best = [b, i];
    return best ? best[1] : null;
  };
  const loadUnivDetails = () => once("univ_details", () => file("univ_details.json"));
  const loadRank = () => once("rank", async () => { const d = await file("rankings.json"); return d.items || []; });
  const loadJobSrc = () => once("jsrc", () => file("job_sources.json"));
  const loadJobNotes = () => once("jnotes", () => file("job_path_notes.json"));
  const enrichShard = id => { let n = 0; for (const ch of String(id)) n = (Math.imul(n, 31) + ch.charCodeAt(0)) >>> 0; return n % 8; };   // tools/shard_enrich.py 의 job_shard 와 같은 식(직업 id → 샤드 0~7)
  const loadJobEnrichItem = async id => { try { const d = await once("jenrich" + enrichShard(id), () => file(`job_enrich_s${enrichShard(id)}.json`)); return (d.items || {})[id] || null; } catch (e) { return null; } };   // 커리어넷 직업백과 공개 화면의 하는 일·적성·준비 방법(없으면 빈 표)
  const loadMajorEnrich = () => once("menrich", async () => { try { return await file("major_enrich_map.json"); } catch (e) { return { map: {} }; } });   // 학과 id → 커리어넷 학과 seq 연결 표(원문은 seq % 8 샤드에서 필요한 것만)
  const loadMajorEnrichItems = async seq => { try { const d = await once("menrich" + (Number(seq) % 8), () => file(`major_enrich_s${Number(seq) % 8}.json`)); return d.items || {}; } catch (e) { return {}; } };   // 커리어넷 학과정보 공개 화면의 학과 개요(없으면 빈 표) — 이름이 같거나 커리어넷이 같은 학과로 묶은 학과만
  function majorOfficialHtml(mid, d, items) {                                    // 학과 공식 소개(커리어넷). 같은 이름이면 그대로, 묶음이면 어느 대표 학과의 소개인지 먼저 밝힌다
    const ref = d && d.map ? d.map[mid] : null, e = ref && items && items[ref[0]];
    if (!e) return "";
    const note = ref[1] === "p" ? `이 이름의 학과를 여는 모든 학교(이 앱 자료 기준)가 커리어넷 학과정보에서 ‘${esc(e.nm)}’ 학과로 확인돼요. 아래는 ‘${esc(e.nm)}’ 소개이고, 각 학교가 직접 밝힌 교육과정 소개가 아니에요. 이 학교 학과의 실제 내용과 다를 수 있어요.` : ref[1] === "n" ? "커리어넷 학과정보에 같은 이름으로 올라 있는 학과 소개예요. 각 학교가 직접 밝힌 교육과정 소개는 아니고, 학교마다 다를 수 있어요." : `커리어넷은 이 이름의 학과를 ‘${esc(e.nm)}’ 학과로 묶어 소개해요. 아래는 ‘${esc(e.nm)}’ 소개이고, 각 학교가 직접 밝힌 교육과정 소개가 아니에요. 이 학교 학과의 실제 내용과 다를 수 있어요.`;
    const after = (e.after || []).map(a => `<li><strong>${esc(a[0])}</strong>${a[1] ? ` — ${esc(a[1])}` : ""}</li>`).join("");
    return `<section class="refbox" data-block="major-official" data-major-kind="${ref[1]}" style="margin-bottom:20px;">
      <h2>학과 소개 · 커리어넷 학과정보</h2>
      <p class="side" data-major-official-note>${note}</p>
      <p style="font-size:15px;line-height:1.75;color:#1e293b;margin:8px 0 12px;">${esc(e.sumry)}</p>
      ${e.interest ? `<h3>이런 학생에게 어울려요</h3><p>${esc(e.interest)}</p>` : ""}${after ? `<h3>졸업 뒤 진로</h3><ul class="plain">${after}</ul>` : ""}
      <p class="side">출처: 커리어넷 학과정보(${esc(e.cl || "대학교")}) · 원문 최종 수정 ${esc(e.updt)} · 확인한 날 ${esc(e.fetched)} · 길면 문장 끝에서 줄여 보여요 · <a class="tap" href="https://www.career.go.kr/cloud/w/major/uView?seq=${esc(d.map[mid][0])}" target="_blank" rel="noopener noreferrer">원문 열기 ↗<span class="sr-only"> (새 창으로 열려요)</span></a></p>
    </section>`;
  }
  const loadSimilar = () => once("simfam", async () => {                     // 비슷한 계열 연결(r2.1): 직업 id → [[학과 id, 신뢰 s|m|w], …]. 확정 연결(job_majors)과 따로 둔다
    const [rows, meta] = await Promise.all([shards("similar_family"), file("similar_family_meta.json")]);
    return { byJob: new Map(rows.map(r => [r[0], r[1]])), meta };
  });
  function similarHtml(links, pa, meta) {                                    // strong·medium = "비슷한 계열에서 살펴볼 학과예요", weak = "같은 분야에서 많이 보는 학과예요(참고용)" — 문구는 자료(display_group)에서 읽는다
    const item = r => { const m = pa.majorById.get(r[0]); return m ? `<li><a class="job" href="#/major/${esc(r[0])}"><span class="name">${esc(m.name)}</span></a></li>` : ""; };
    const near = links.filter(r => r[1] !== "w"), pop = links.filter(r => r[1] === "w");
    let h = "";
    if (near.length) h += `<section class="refbox" data-simfam="near"><h3>${esc(meta.display_group.near)} <span class="count">${near.length}개</span></h3><p class="side">이 직업과 이어진 학과가 자료에 아직 없어서, 이름과 분야가 비슷한 학과를 골라 보여 드려요. 확정된 연결이 아니에요.</p><ul class="majors">${near.map(item).join("")}</ul></section>`;
    if (pop.length) h += `<section class="refbox" data-simfam="popular"><h3>${esc(meta.display_group.popular)} <span class="count">${pop.length}개</span></h3><p class="side">이 직업과 이름이 맞닿는 근거는 없고, 같은 분야에서 자주 보이는 학과예요. 참고용으로만 봐 주세요.</p><ul class="majors">${pop.map(item).join("")}</ul></section>`;
    return h;
  }
  const loadChrPend = () => once("chrp", async () => { const d = await file("christian_pending.json"); return d.items; });
  const loadChrPublic = () => once("chrpub", async () => { const d = await file("christian_public.json"); return new Map(d.items.filter(i => i.code).map(i => [i.code, i])); });   // 학교 경로 표 없이 코드→공식 인용만(특수학교 화면용)
  const loadHeresy = () => once("heresy", () => file("christian_heresy_check.json"));
  const loadRankRefs = () => once("rrefs", () => file("ranking_refs.json"));
  const loadTerms = () => once("terms", () => file("terms.json"));
  const loadBible56 = () => once("bible56", async () => { const d = await file("biblical56.json"); return { ...d, byKey: new Map(d.combos.map(c => [c.key, c])) }; });   // 은사 조합별 성경 인물(정본 data/v2/biblical56.json — 달란트로드 PERSONAS 와 같은 배정)
  /* 선택형 위치 보기(2단계 개정): 학교 상세에서 '지도에서 보기'를 눌렀을 때만 그 학교 한 곳의 점 자료(샤드 1개)·변환식·경계 SVG 1개를 읽는다. */
  async function loadSchoolPoint(id) {
    const m = D["manifest.json"].shards.coords_points;
    const sh = m.find(e => id >= e.first_key && id <= e.last_key);
    if (!sh) return null;
    const doc = await file(sh.file);
    const r = doc.rows.find(x => x[0] === id);
    return r ? { lat: r[1], lon: r[2], m: r[3] } : null;
  }
  async function loadSigungu(sido) {                                    // 눌렀을 때만: 그 시·도의 시·군·구 경계 파일 1개
    const slug = GEO_SLUG[sido];
    if (!slug) return null;
    if (!GEO.sg[sido]) GEO.sg[sido] = await file("geo_sigungu/" + slug + ".json");
    return GEO.sg[sido];
  }
  const APPROX_NOTE = "주소 기준 대략 위치예요(정확한 점이 아니에요)";
  function locationHtml(info) {                                           // 위치 칸: 주소·시군구·점 자료 중 하나라도 있으면 '지도에서 보기' 버튼(점 자료는 M1 점·M2 추정 점, 없으면 시군구·시도 경계 대략 위치), 아무것도 없으면 버튼 없이 안내
    const { id, addr, p } = info, sido = info.sido || "", sg = info.sg || "";
    if (!p && !addr && !sg && !sido) return `<p class="side" data-loc="none">위치 자료가 아직 없어요.</p>`;
    const kind = p ? (p.m === 1 ? "point" : "estimate") : "approx";
    return `<section class="locbox" data-loc="${kind}"><h2>위치</h2>${p && p.m === 2 ? `<p class="side"><span class="tag" data-badge="estimate">위치 추정</span> 주소만 맞은 공개 위치 자료예요. 정확한 점이 아닐 수 있어요.</p>` : ""}${p ? "" : `<p class="side" data-loc-note="approx">${APPROX_NOTE} 정확한 위치 자료가 없어서 점은 찍지 않고 해당 지역만 칠해 보여 드려요.</p>`}
      <p><button type="button" class="btn ghost" id="loc-open" aria-expanded="false" aria-controls="loc-panel" data-loc-id="${esc(id)}" data-loc-sido="${esc(sido)}" data-loc-sg="${esc(sg)}" data-loc-m="${p ? p.m : 0}">지도에서 보기</button></p><div id="loc-panel" hidden></div></section>`;
  }
  async function toggleLoc(btn) {                                         // '지도에서 보기' 열기·닫기
    const panel = document.getElementById("loc-panel");
    if (btn.getAttribute("aria-expanded") === "true") { btn.setAttribute("aria-expanded", "false"); btn.textContent = "지도에서 보기"; panel.hidden = true; return; }
    btn.setAttribute("aria-expanded", "true"); btn.textContent = "지도 닫기"; panel.hidden = false;
    if (panel.dataset.ready) return;
    panel.innerHTML = `<p class="side">위치를 불러오는 중이에요.</p>`;
    try {
      const sido = btn.dataset.locSido, m = Number(btn.dataset.locM);
      const sg = btn.dataset.locSg;
      const CAP = "경계는 통계청 통계지리정보서비스(공공누리 제1유형)의 2020년 행정구역 경계를 단순하게 줄인 그림이라 실제 경계와 조금 다를 수 있어요. 길 찾기용 지도가 아니에요.";
      if (m) {                                                            // 검수된 점 자료: M1 점·M2 추정 점
        const [doc, CT, p] = await Promise.all([loadSigungu(sido), file("coord_transforms.json"), loadSchoolPoint(btn.dataset.locId)]);
        const tr = CT.sigungu[sido];
        if (!doc || !tr || !p) throw new Error("no point");
        const [x, y] = xyOf(tr.abcd, p.lon, p.lat);
        const paths = doc.regions.map(r => `<path d="${r.d}" class="reg l0${r.key === sg ? " sel" : ""}"><title>${esc(r.key)}</title></path>`).join("");
        const dot = `<g class="dotlayer each"><circle class="dot ${m === 1 ? "m1" : "m2"}" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="7"><title>${m === 1 ? "위치" : "위치 추정"}</title></circle></g>`;
        panel.innerHTML = `<figure class="locmap" data-locmap="${m === 1 ? "point" : "estimate"}"><svg class="geosvg" viewBox="${doc.viewBox.join(" ")}" aria-hidden="true" focusable="false">${paths}${dot}</svg>
        <figcaption>${m === 1 ? "● 이름과 주소가 모두 맞은 공개 위치 자료예요." : `<span class="tag">위치 추정</span> ○ 주소만 맞은 공개 위치 자료예요.`} 위도 ${p.lat} · 경도 ${p.lon}. 진한 칸이 이 학교가 있는 시·군·구예요. ${CAP} 점이 경계 근처에서 조금 어긋나 보일 수 있어요.</figcaption></figure>`;
      } else {                                                            // 점 자료 없음(좌표 없음·M3): 점 없이 시·군·구(없으면 시·도) 경계만 칠한 대략 위치
        const doc = sido ? await loadSigungu(sido) : null;
        let svg = "", level = "";
        if (doc && sg && doc.regions.some(r => r.key === sg)) {
          svg = `<svg class="geosvg" viewBox="${doc.viewBox.join(" ")}" aria-hidden="true" focusable="false">${doc.regions.map(r => `<path d="${r.d}" class="reg l0${r.key === sg ? " sel" : ""}"><title>${esc(r.key)}</title></path>`).join("")}</svg>`;
          level = `진한 칸이 주소의 시·군·구(${esc(sg)})예요.`;
        } else if (sido) {
          if (!GEO.sido) GEO.sido = await file("geo_sido.json");
          const sd = GEO.sido;
          if (!sd.regions.some(r => r.key === sido)) throw new Error("no sido");
          svg = `<svg class="geosvg" viewBox="${sd.viewBox.join(" ")}" aria-hidden="true" focusable="false">${sd.regions.map(r => `<path d="${r.d}" class="reg l0${r.key === sido ? " sel" : ""}"><title>${esc(r.key)}</title></path>`).join("")}</svg>`;
          level = `시·군·구를 확인하지 못해 시·도(${esc(sido)}) 수준으로만 칠했어요.`;
        } else throw new Error("no area");
        panel.innerHTML = `<figure class="locmap" data-locmap="approx">${svg}<figcaption><strong>${APPROX_NOTE}</strong> ${level} ${CAP}</figcaption></figure>`;
      }
      panel.dataset.ready = "1";
    } catch (e) { panel.innerHTML = `<p class="notice">지금은 위치를 보여 드리지 못해요.</p>`; }
  }

  /* 입구 3 자료: 별도 특수학교 202곳(schools_special) + 일반학교 안 특수학급이 있는 학교(schools_k12 에서 특수학급 수가 1 이상인 일반 학교 9,910곳) */
  const SIDO_SHORT = { "서울특별시": "서울", "부산광역시": "부산", "대구광역시": "대구", "인천광역시": "인천", "광주광역시": "광주", "대전광역시": "대전", "울산광역시": "울산", "세종특별자치시": "세종", "경기도": "경기",
    "강원특별자치도": "강원", "강원도": "강원", "충청북도": "충북", "충청남도": "충남", "전북특별자치도": "전북", "전라북도": "전북", "전라남도": "전남", "경상북도": "경북", "경상남도": "경남", "제주특별자치도": "제주",
    "전남광주통합특별시(광주)": "광주", "전남광주통합특별시(전남)": "전남" };
  const SIDO_ORDER = ["서울", "부산", "대구", "인천", "광주", "대전", "울산", "세종", "경기", "강원", "충북", "충남", "전북", "전남", "경북", "경남", "제주"];
  const LEVELS = ["유치원", "초등학교", "중학교", "고등학교"];
  const OTHER_LEVEL = "그 밖의 학교";
  const sidoOf = v => SIDO_SHORT[v] || v || "";
  const validSg = v => { const t = String(v || "").replace(/[.\s]+$/, ""); return /^[가-힣]+[시군구]$/.test(t) && !/(특별시|광역시|특별자치시)$/.test(t) ? t : ""; };
  const sgOf = (sg, gu) => validSg(sg) || validSg(gu);
  const tidy = v => String(v == null ? "" : v).replace(/\s+/g, " ").trim();
  const homeUrl = v => { const t = tidy(v).replace(/^(?:https?:\/*)+(?=https?:\/\/)/i, ""); if (!t) return "";   /* 원자료에 'http://http://…'·'http://https://…'처럼 주소 머리가 겹친 곳이 있어 마지막 머리만 쓴다 */ const u = /^https?:\/\//i.test(t) ? t : "https://" + t; return /^https?:\/\/[^\s"'<>]*\.[^\s"'<>]+$/.test(u) ? u : ""; };
  const telHref = v => { const t = tidy(v), d = t.replace(/[^0-9]/g, ""); return /^[0-9][0-9\- ]{6,}$/.test(t) && d.length >= 7 ? "tel:" + d : ""; };
  async function dictRows(table, expand) {                              // 사전 번호로 줄인 표(색인·특수학급 부분집합)를 원래 K12 행 모양(16칸)으로 되돌린다 — 아래 코드는 그대로 쓴다
    const docs = await Promise.all(D["manifest.json"].shards[table].map(s => file(s.file, BULK_TIMEOUT_MS)));
    const dict = docs[0].dict, pick = (k, i) => i == null ? null : dict[k][i];
    return docs.flatMap(d => d.rows).map(x => expand(x, pick));
  }
  const k12SpecialRows = () => dictRows("schools_k12_special", (x, p) => ["k12-" + x[0], x[1], p(0, x[2]), p(1, x[3]), null, p(2, x[4]), p(3, x[5]), p(4, x[6]), null, null, x[7], x[8], x[9], x[10], x[11], x[14] === true, x[12], x[13]]);
  const loadSpecialProfile = () => once("spprofile", async () => { try { return await file("special_profile.json"); } catch (e) { return { items: {}, types: [], stages: [] }; } });   // 학교 공식 누리집 원문에서 읽은 교육 대상 장애영역·설치 과정(없으면 null=확인 못함)
  const NONE = "__none", DIS_NONE_LABEL = "정보 없음(확인하지 못함)";
  const loadSpecial = () => once("special", async () => {
    const [spDoc, k12, pub, profDoc] = await Promise.all([file("schools_special.json", BULK_TIMEOUT_MS), k12SpecialRows(), loadChrPublic().catch(() => new Map()), loadSpecialProfile()]);
    const kess = new Map(k12.map(r => [r[0], r]));
    const officeBySido = new Map();                                       // 일반학교 자료에는 관할 교육청 칸이 없어, 같은 시·도 특수학교 자료의 교육청 이름을 쓴다
    for (const r of spDoc.rows) if (r[7] && !officeBySido.has(sidoOf(r[3]))) officeBySido.set(sidoOf(r[3]), tidy(r[7]));
    const from = (id, name, sidoRaw, sigungu, gu, est, address, level, k, office) => ({
      id, name, sido: sidoOf(sidoRaw), sg: sgOf(sigungu, gu), est, address: tidy(address), level, office: tidy(office) || officeBySido.get(sidoOf(sidoRaw)) || "",
      kid: k ? k[0] : "", phone: k ? tidy(k[11]) : "", home: k ? homeUrl(k[12]) : "", classes: k ? k[13] : null, students: k ? k[14] : null, chr: false, key: tidy(name).replace(/\s/g, "").toLowerCase() });
    const school = spDoc.rows.map(r => { const o = from(r[0], r[2], r[3], r[4], r[5], r[6], r[8], "특수학교", r[10] ? kess.get(r[10]) : null, r[7]); const prof = profDoc.items[r[0]] || null; return { ...o, phone: o.phone || tidy(r[12]), home: o.home || homeUrl(r[13]), chr: r[11] === true, ev: pub.get(r[0]) || (r[10] && pub.get(r[10])) || null, prof, dis: prof && prof.dis && prof.dis.length ? prof.dis : null, stage: prof && prof.stage && prof.stage.length ? prof.stage : null }; });
    const klass = k12.filter(r => r[13] > 0 && r[2] !== "특수학교")
      .map(r => ({ ...from(r[0], r[1], r[3], r[5], r[6], r[7], r[10], LEVELS.includes(r[2]) ? r[2] : OTHER_LEVEL, r), chr: r[15] === true, ev: pub.get(r[0]) || null, totalClasses: r[16], totalStudents: r[17] }));
    return { school, klass };
  });

  /* ---------- 화면 상태(메모리에만) ---------- */
  const st = { picked: new Set(), ptype: "", fieldsOff: new Set(), wide: false, shown: {}, jobsShown: PAGE, lastRange: "#/", lastJob: null, region: "", level: "",
    sp: { sido: "", sg: "", level: "", est: "", q: "", dis: [], stg: [], shown: PAGE },
    s: { tab: "job", q: "", cat: "", shown: PAGE, sido: "", sg: "" }, origin: "", lastSearch: "#/search" };

  /* ---------- 공통 조각 ---------- */
  const crumbs = list => `<nav class="crumbs" aria-label="지금 위치">${list.map(([t, h]) => h ? `<a href="${h}">${esc(t)}</a>` : `<span aria-current="page">${esc(t)}</span>`).join(" › ")}</nav>`;
  const originCrumb = () => st.origin === "search" ? [["직접 검색하기", st.lastSearch]] : [];
  const again = () => `<p><a class="tap" href="${st.lastSearch}">다른 이름으로 찾아보기</a></p>`;
  const giftsText = key => key.split("+").map(g => GIFT[g]).join(" · ");
  const evidence = () => "";   // 오너 결정(2026-10-21): '근거 더 보기' 펼침은 쓰지 않는다. 호출부는 그대로 두고 빈 문자열을 돌려준다.
  const moreBtn = (k, total) => (st.shown[k] || PAGE) < total ? `<p><button type="button" class="btn ghost" data-more="${k}">더 보기</button></p>` : "";
  const limit = (k, arr) => arr.slice(0, st.shown[k] || PAGE);
  const ymText = v => { const m = /^(\d{4})-(\d{2})/.exec(v || ""); return m ? `${m[1]}년 ${Number(m[2])}월` : ""; };
  const faithOf = it => (it && it.faith) || (it && it.tier === "fcsk_list_only" ? "" : "개신교");   // 명단 등재만 확인한 곳(tier fcsk_list_only)은 faith 가 비어 있어도 개신교 기본값을 주지 않는다
  const FAITH_WORD = { "개신교": "기독교", "가톨릭": "가톨릭", "성공회": "성공회", "삼육(제칠일안식일예수재림교)": "삼육" };
  const faithWord = it => FAITH_WORD[faithOf(it)] || "기독교";
  const isListOnly = it => !!it && it !== true && it.tier === "fcsk_list_only";   // 한국기독교학교연맹 명단 등재만 확인한 곳: 기독교 학교 배지·필터·개수·모기관 기준 문구에 넣지 않고 상세에 scope_text 문구만 보인다
  const isProt = it => !!it && !isListOnly(it) && faithOf(it) === "개신교";                // 기독교 학교 표시·우선 정렬·필터는 개신교만. 가톨릭·성공회·삼육은 실제 소속 이름으로 따로 표시한다
  const faithKind = (it, k) => isProt(it) ? k : String(k).replace(/^기독교\s?/, faithWord(it) + " ").trim();
  const chrTags = it => it && !isListOnly(it) ? it.kinds.map(k => `<span class="tag chr">✝ ${esc(faithKind(it, k))}</span>`).join("") : "";
  /* 기독교 최상단 정렬(christianFirstSort): 학교는 허용 목록 통과·기독교 분류 학교를, 직업은 이름에 신학·선교·예배·목회 등이 든 사역 직업을 먼저 둔다. 같은 무리 안의 순서는 원래 정렬을 그대로 쓴다. */
  const CHR_JOB = /신학|선교|예배|목회|목사|교회|사역|찬양|성경|기독|전도/;
  const isChrJob = j => !!j && (CHR_JOB.test(j.name || "") || j.group === "christian_vocation");
  const chrJobFirst = (a, b) => Number(isChrJob(b)) - Number(isChrJob(a));
  const CHR_MAJOR = /(?!.*참부모)(?<![정혁통순효])신학|기독|선교|목회|교회|성경|교역|예배|찬양/;                  // 정신학·혁신학처럼 글자가 우연히 이어진 이름과, 기독교 근거가 이름에 없는 '영성'은 뺀다
  const FIELD_HELP = { "경영·창업": "새로운 아이디어로 일을 만들고 조직을 이끄는 분야예요.", "AI·기술": "기술로 사람들의 생활을 더 편리하고 안전하게 만드는 분야예요.", "교육·직업훈련": "사람이 배우고 자라도록 가르치고 이끄는 분야예요.", "온라인·콘텐츠": "글·영상·소리로 좋은 이야기를 널리 전하는 분야예요.", "사회·복지": "도움이 필요한 이웃 곁에서 함께 살아가도록 돕는 분야예요.", "예술·문화": "아름다움과 이야기로 마음을 움직이는 분야예요.", "돌봄·의료·보건": "아프거나 도움이 필요한 사람을 돌보고 건강을 지키는 분야예요.", "공공·공익": "모두에게 필요한 일을 맡아 사회를 건강하게 지키는 분야예요.", "국제·해외": "다른 나라와 문화 사이에서 사람과 사람을 잇는 분야예요." };
  const jobGifts = (sc, id) => {                                          // 달란트로드 조합 가운데 이 직업이 소개된 조합의 은사 글자를 센다. 동점은 글자순으로 자르지 않고 모두 보이며, 근거가 흐리면(소개된 조합이 적고 은사가 많이 갈리면) 문구를 만들지 않는다
    const c = {}; let n = 0;
    for (const x of sc.combos.values()) if (x.job_ids.includes(id)) { n++; for (const g of x.key.split("+")) c[g] = (c[g] || 0) + 1; }
    const all = Object.entries(c).sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1));
    if (!n) return { n, gifts: [], kind: "" };
    if (n <= 2) return all.length <= 4 ? { n, gifts: all.map(e => GIFT[e[0]]).filter(Boolean), kind: "few" } : { n, gifts: [], kind: "" };
    const cut = all[Math.min(1, all.length - 1)][1], top = all.filter(e => e[1] >= cut);          // 2위와 같은 횟수까지 모두
    return top.length <= 3 ? { n, gifts: top.map(e => GIFT[e[0]]).filter(Boolean), kind: "many" } : { n, gifts: [], kind: "" };
  };
  /* 기독교 표시 규칙(검색·목록·상세 공통): 공식 인용이 있는 곳만 '확인됨'. 자기 코드의 인용, 또는 자료에 기독교 표시가 있는 대학원·학과·부설기관이면 본교 인용.
     표시만 있고 인용이 없으면 '미확인' — 배지·우선 배치 없이 상세에서 안내만 한다. 이름 글자만으로는 판정하지 않는다. */
  const chrEv = (chr, code, name, flag) => chr.get(code) || (flag ? chrOf(chr, code, name) : null);
  const isChrSchool = (chr, s) => isProt(s && chrEv(chr, s.code, s.name, s.chr));
  const chrSchoolFirst = (chr, a, b) => Number(isChrSchool(chr, b)) - Number(isChrSchool(chr, a));
  const chrSchoolTags = (chr, s) => chrTags(s && chrEv(chr, s.code, s.name, s.chr));
  /* 인용 이름표는 자료의 근거 종류(evidence_kind)에 그 말이 있을 때만 쓴다 — 학교 소개·운영주체·인사말 문구를 '건학이념'이라 부르지 않는다. '공식 자료' 문장도 근거 종류가 공식일 때만. */
  const chrQuoteLabel = it => (/(건학이념|설립이념|교육이념|설립정신|설립목적|교육목표|교훈)/.exec(String((it && it.evidence_kind) || "")) || [, "근거 문구"])[1];
  const chrOfficial = it => /공식/.test(String((it && it.evidence_kind) || ""));
  const chrVision = it => it && !isListOnly(it) && it.quote ? `<span class="side chr-vision">${chrQuoteLabel(it)} “${esc(it.quote.length > 46 ? it.quote.slice(0, 46) + "…" : it.quote)}”</span>` : "";
  /* 소명의 말씀: 개역개정 본문. 분야·학교 종류에 맞춰 고른 장식 구절이며, 학교나 직업 자료의 근거와는 따로 표시한다. */
  const V = (ref, text) => ({ ref, text });
  const POKE_VERSES = {
    fields: { "경영·창업": V("잠 16:3", "너의 행사를 여호와께 맡기라 그리하면 네가 경영하는 것이 이루어지리라"), "AI·기술": V("엡 2:10", "우리는 그가 만드신 바라 그리스도 예수 안에서 선한 일을 위하여 지으심을 받은 자니 이 일은 하나님이 전에 예비하사 우리로 그 가운데서 행하게 하려 하심이니라"),
      "교육·직업훈련": V("잠 22:6", "마땅히 행할 길을 아이에게 가르치라 그리하면 늙어도 그것을 떠나지 아니하리라"), "온라인·콘텐츠": V("엡 5:9", "빛의 열매는 모든 착함과 의로움과 진실함에 있느니라"),
      "사회·복지": V("딤전 6:18", "선을 행하고 선한 사업을 많이 하고 나누어 주기를 좋아하며 너그러운 자가 되게 하라"), "예술·문화": V("고전 10:31", "그런즉 너희가 먹든지 마시든지 무엇을 하든지 다 하나님의 영광을 위하여 하라"),
      "돌봄·의료·보건": V("마 25:40", "내가 진실로 너희에게 이르노니 너희가 여기 내 형제 중에 지극히 작은 자 하나에게 한 것이 곧 내게 한 것이니라"), "공공·공익": V("미 6:8", "사람아 주께서 선한 것이 무엇임을 네게 보이셨나니 여호와께서 네게 구하시는 것은 오직 정의를 행하며 인자를 사랑하며 겸손하게 네 하나님과 함께 행하는 것이 아니냐"),
      "국제·해외": V("벧전 4:10", "각각 은사를 받은 대로 하나님의 여러 가지 은혜를 맡은 선한 청지기 같이 서로 봉사하라") } };
  POKE_VERSES.def = POKE_VERSES.fields["국제·해외"];
  const VERSE_FOR = { univ: POKE_VERSES.fields["국제·해외"], k12: POKE_VERSES.fields["교육·직업훈련"], special: POKE_VERSES.fields["돌봄·의료·보건"], org: POKE_VERSES.fields["예술·문화"] };
  const verseHtml = v => `<div class="poke-verse"><span class="verse-tag">소명의 말씀</span><span class="verse-text">“${esc(v.text)}”</span><cite class="verse-ref">(${esc(v.ref)})</cite></div>`;
  const CHR_BADGE = `<span class="poke-chr-badge">✝ 기독교 학교</span>`, CHR_BADGE_ORG = `<span class="poke-chr-badge">✝ 기독교 기관</span>`;
  const FAITH_BADGE = { "개신교": "기독교 학교", "가톨릭": "가톨릭 학교", "성공회": "성공회 학교", "삼육(제칠일안식일예수재림교)": "삼육 학교 · 제칠일안식일예수재림교" };
  /* 배지·소개·근거 안내는 같은 근거 상태를 쓴다: 이 학교(학과)가 직접 밝힌 글이면 그대로, 모기관·본교의 글만 있으면(basis_parent 또는 본교 근거를 빌린 경우) '모기관 기준'으로 표시해 자체 확정처럼 보이지 않게 한다. */
  const chrBadge = (it, org, parentOnly) => isListOnly(it) ? "" : org ? CHR_BADGE_ORG : `<span class="poke-chr-badge" data-faith="${esc(faithOf(it))}"${parentOnly || (it && it.basis_parent) ? ' data-basis="parent"' : ""}>✝ ${parentOnly || (it && it.basis_parent) ? "모기관 기준 · " : ""}${FAITH_BADGE[faithOf(it)] || "기독교 학교"}</span>`;
  function chrBlock(it, kind, parent, subject) {                               // 허용 목록을 통과한 학교만 파일에 있다. 교단은 원문에 있을 때만 그대로, 없으면 표기 생략. parent=본교 인용을 빌려 온 곳 — 확인 범위를 본교로 한정해 밝힌다.
    if (!it) return "";
    if (isListOnly(it)) return `<section class="chrbox" data-chr="fcsk-list-only" aria-label="명단 등재 안내"><p class="side">${esc(it.scope_text || "")}</p></section>`;
    const org = kind === "org", lab = chrQuoteLabel(it), off = chrOfficial(it), fw = faithWord(it), who = subject || (org ? "기관" : (kind === "k12" || kind === "special" || /^inst-/.test(String(it.code || "")) ? "학교" : "학과·대학원"));   // 화면이 가리키는 대상(subject: 학과·대학원/학교)을 우선, 없으면 ID 종류로 — 대학 본체(inst-)에는 '이 학교'
    const srcUrl = homeUrl(it.url);                                    // 인용을 낸 공식 글 주소 — 사용자가 직접 열어 확인할 수 있게 링크로 보인다
    const pName = parent ? it.name : it.basis_parent;                // 본교 접두로 빌린 근거, 또는 자료가 '모기관 근거'(basis_parent)라고 밝힌 항목
    return `<section class="chrbox" aria-label="${fw} 표시"><p class="tags">${chrBadge(it, org, parent)}${it.kinds.filter(k => !/^(기독교|가톨릭|성공회|삼육)\s?(대학|학교|기관)$/.test(faithKind(it, k))).map(k => `<span class="tag chr">✝ ${esc(faithKind(it, k))}</span>`).join("")}</p>${pName
      ? `<p class="lead">${parent ? "본교" : "모기관"}인 ${esc(josa(pName, "은", "는"))} ${off ? "공식 글로 " : ""}${fw} 신앙을 바탕으로 한 곳임을 확인했어요.</p><p class="side" data-chr="parent">아래 ${josa(lab, "은", "는")} ${parent ? "본교" : "모기관"}의 ${off ? "공식 " : ""}글이에요. 이 ${who} 자체의 신앙 내용은 따로 확인하지 않았어요.</p>`
      : `<p class="lead">${fw} ${org ? "기관으로" : "학교로"} 확인했어요.</p>${faithOf(it) === "삼육(제칠일안식일예수재림교)" ? `<p class="side" data-chr="samyook">삼육 학교를 세워 운영하는 학교법인 삼육학원은 정관 제1조에서 제칠일안식일예수재림교의 교육 이념을 목적으로 밝혀요. 법인과 교단(교회)은 서로 다른 조직이고, 일반 기독교(개신교) 학교와 같은 표시로 묶지 않고 실제 교단 이름으로 따로 보여 드려요.</p>` : ""}`}
      <blockquote class="chr-quote"><b>${lab}</b> “${esc(it.quote)}” <span class="side">— ${esc(it.evidence_kind)}</span></blockquote>${srcUrl ? `<p class="side" data-chr="source"><a class="tap" href="${esc(srcUrl)}" target="_blank" rel="noopener noreferrer">공식 출처 열기 ↗<span class="sr-only"> (새 창으로 열려요)</span></a>${it.url_note ? ` ${esc(it.url_note)}` : ""}</p>` : ""}${!pName && (/본교/.test(String(it.evidence_kind || "")) || /^dept-/.test(String(it.code || ""))) ? `<p class="side" data-chr="parent-scope">위 글은 본교(학교 전체) 또는 운영 법인의 공식 글이에요. 이 ${who} 자체의 신앙 내용은 따로 확인하지 않았어요.</p>` : ""}${it.denomination && !/^미확인/.test(String(it.denomination).trim()) ? `<p class="side">교단: ${esc(it.denomination)}</p>` : ""}${it.dept ? `<p class="side">관련 학과: ${esc(it.dept)}</p>` : ""}
      ${verseHtml(VERSE_FOR[kind || "univ"])}
      </section>`;
  }
  function chrFlagBlock(kind) {                                       // 자료에 기독교 표시만 있고 공식 인용이 아직 없는 곳(미확인): 확정 배지·소명의 말씀 없이 안내만
    const w = kind === "org" ? "기관" : "학교", wr = kind === "org" ? "기관으로" : "학교로";
    return `<p class="side" data-chr="unverified">기독교 ${wr} 분류한 자료가 있지만, ${w}의 공식 글로는 아직 확인하지 못했어요. 확인되기 전에는 기독교 ${wr} 표시하지 않아요.</p>`;
  }
  function rankBlock(items, code) {                                   // 조사기관·발표연도·자료 유형이 모두 있는 자료만. 없으면 아무것도 그리지 않는다.
    const rows = (items || []).filter(r => r.target_code === code && r.publisher && r.year && r.data_type && RANK_TYPE[r.data_type] && RANK_MEASURE[r.measure]);
    if (!rows.length) return "";
    return `<section class="rankbox"><h2>공개된 순위·배출 자료</h2><ul class="majors">${rows.map(r => `<li><strong>${esc(RANK_MEASURE[r.measure])}</strong> ${esc(r.value)}${r.unit ? esc(r.unit) : ""}<br><span class="side">${esc(r.publisher)} · ${esc(r.year)}년 발표 · 자료 유형: ${esc(RANK_TYPE[r.data_type])}</span>
      </li>`).join("")}</ul>
      <p class="side">이 순위와 수치는 조사한 기관이 발표한 것이에요. 소명지도가 보증하지 않고, 기관마다 기준이 달라요.</p></section>`;
  }
  /* 통합 지도: 결과 화면마다 1개. 실제 경계 지도가 아니라 시도 17곳을 대략의 위치에 놓은 칸 지도예요(좌표·외부 지도 없음). */
  function geoSvg(doc, counts, selected, ctx, attr, sgSelected, extra) {
    const max = Math.max(1, ...Object.values(counts));
    const paths = doc.regions.map(r => {
      const n = counts[r.key] || 0, lvl = n ? 1 + Math.min(3, Math.floor((n / max) * 3.99)) : 0;
      const sel = (attr === "tile" ? selected : sgSelected) === r.key ? " sel" : "";
      return `<path d="${r.d}" class="reg l${lvl}${sel}"${n ? ` data-${attr}="${esc(r.key)}" data-tilectx="${ctx}"` : ""}><title>${esc(r.key)} ${n.toLocaleString("ko-KR")}곳</title></path>`;
    }).join("");
    return `<svg class="geosvg" viewBox="${doc.viewBox.join(" ")}" aria-hidden="true" focusable="false">${paths}${extra || ""}</svg>`;
  }
  const xyOf = (t, lon, lat) => [t[0] * lon + t[1], t[2] * lat + t[3]];
  function jobItem(j) {
    const sub = [j.field, j.linked ? `학과 ${j.majorCount}개` : ""].filter(Boolean).join(" · ");
    return `<li><a class="job" href="#/job/${esc(j.id)}"><span class="name">${esc(j.name)}</span>${sub ? `<span class="sub">${esc(sub)}</span>` : ""}</a>${isChrJob(j) ? `<span class="tag chr">✝ 사역·선교 직업</span>` : ""}</li>`;
  }

  /* ---------- 화면 ---------- */
  /* ---------- 3차 반영: 상세 소개 보강 ---------- */
  const NOINFO = "아직 확인하지 못한 정보입니다";
  const hasBatchim = w => { const c = String(w).trim().slice(-1).charCodeAt(0); return c >= 0xAC00 && c <= 0xD7A3 ? (c - 0xAC00) % 28 !== 0 : null; };
  const josa = (w, a, b) => { const bt = hasBatchim(w); return w + (bt === null ? a + "(" + b + ")" : bt ? a : b); };      // 은/는 (한글이 아닌 끝글자는 '은(는)')
  const ie = w => { const bt = hasBatchim(w); return bt === null ? "이에요" : bt ? "이에요" : "예요"; };
  function heroFig(kind, name) {                                           // 대표 이미지: 학교·기관별 공식 이미지 자료가 없어 이음교육연구소 기존 안내 그림만 쓴다(사진 아님을 밝힘)
    const f = kind === "org" ? "institute-256.webp" : "school-256.webp";
    return `<figure class="herofig" data-hero="${kind}"><img src="assets/${f}" width="128" height="128" alt="${esc(name)} 안내 그림"><figcaption>이 그림은 ${esc(name)}의 사진이 아니라, 소명지도의 공통 안내 그림이에요.</figcaption></figure>`;
  }
  const introP = t => `<p class="lead" data-intro="1">${esc(t)}</p>`;
  function k12Intro(name, level, est, sido, sg, classes, state) {            // 원자료의 확인된 필드(학교급·설립·지역·특수학급 수·상태)로만 만든 문장
    const region = [sido, sg].filter(Boolean).join(" "), kind = [est, level].filter(Boolean).join(" ") || "학교";
    let t = `${josa(name, "은", "는")} ${region ? region + "에 있는 " : ""}${kind}${ie(kind)}.`;
    if (classes > 0 && level !== "특수학교") t += ` 특수학급이 ${classes}개 있어요.`;
    if (state) t += ` 지금은 ${state}${ie(state)}.`;
    return t;
  }
  const lostBlock = (what, backHref) => `<p class="side" data-nodata="${what}">${NOINFO}.</p>`;

  /* ---------- 1단계 반영: 연결 출처 · 기독교 확인 현황 · 순위 참고 링크 · 이용조건 ---------- */
  const textOnly = v => String(v == null ? "" : v);
  function jobEnrichHtml(e) {                                             // 직업 상세의 서술 보강(하는 일·어울리는 사람·준비 방법) — 출처와 확인한 날을 함께 적는다
    if (!e) return "";
    const ps = a => (a || []).map(t => `<p>${esc(t)}</p>`).join("");
    const fit = [...(e.aptitude || []), ...(e.interest || [])];
    const prep = [...((e.prep || {}).edu || []), ...((e.prep || {}).training || []), ...((e.prep || {}).cert || [])];
    return `<section class="refbox" data-jobenrich="1">${e.via ? `<p class="side" data-jobvia="1">${e.src ? esc(e.src.name.replace(/\(.*$/, "")) : "커리어넷 직업백과"}에서 이 직업 이름은 ‘${esc(e.via.name)}’(${esc(e.via.how)}) 항목에 올라 있어요. 아래 내용은 ‘${esc(e.via.name)}’ 설명이에요.</p>` : ""}${e.work && e.work.length ? `<h2>이 직업은 이런 일을 해요</h2>${ps(e.work)}` : ""}${fit.length ? `<h2>이런 사람에게 잘 맞아요</h2>${ps(fit)}` : ""}${prep.length ? `<h2>이렇게 준비해요</h2>${ps(prep)}` : ""}${e.rel && e.rel.length ? `<h2>커리어넷이 관련 학과로 소개하는 학과 <span class="count">${e.rel.length}개</span></h2><p class="side" data-jobrel="1">커리어넷 직업백과가 이 직업의 관련 학과로 올린 이름이에요. 아래 ‘이 직업을 준비하는 길’ 표에는 아직 연결되지 않은 학과만 보여 드려요. 이 앱의 확정 연결이 아니에요.</p><ul class="majors">${e.rel.map(r => `<li><a class="job" href="#/major/${esc(r[0])}"><span class="name">${esc(r[1])}</span></a></li>`).join("")}</ul>` : ""}<p class="side">${e.src ? esc(e.src.name) : "커리어넷 직업백과"}에서 읽은 내용이에요${e.src && e.src.year ? ` (조사년도 ${esc(e.src.year)})` : ""} · 확인한 날 ${esc(e.fetched)} · <a class="tap" href="${e.src ? esc(e.src.url) : `https://www.career.go.kr/cloud/w/job/view?seq=${esc(e.seq)}`}" target="_blank" rel="noopener noreferrer">원문 열기 ↗<span class="sr-only"> (새 창으로 열려요)</span></a></p></section>`;
  }
  function jobSourceHtml(info, linked, terms) {                          // 직업→학과 연결의 출처(공개 주소가 없으면 '내부 자료'라고 그대로 적는다)
    const card = (terms && terms.card) || [];
    const noLink = (card[1] || "").replace(/^연결이 없는 직업:\s*/, "");
    if (!linked || !info) return "";
    const where = info.internal || !info.public_url ? `<strong>내부 자료</strong>(공개 주소가 없는 자료예요)` : `<a class="tap" href="${esc(info.public_url)}" target="_blank" rel="noopener noreferrer">${esc(info.source_name)} 열기</a>`;
    const name = info.origin === "talentroad" ? "학과 정보 표" : info.source_name;
    return `<section class="refbox" data-jobsrc="${esc(info.origin)}"><h2>이 연결은 어디에서 왔나요</h2><p class="side">${esc(card[0] || "")}</p>
      <ul class="majors"><li><strong>출처</strong> ${esc(name)} · ${where}<br><span class="side">확인한 날 ${esc(info.checked)} · 연결한 학과 ${info.links}개</span></li></ul>
      ${info.origin === "talentroad" ? `<p class="side">이 표는 공공데이터포털의 「전국대학별학과정보표준데이터」(한국대학교육협의회)에 학과가 스스로 적어 둔 관련 직업 이름을 바탕으로 해요. 이 연결 기록에는 그 공개 주소가 적혀 있지 않아요.</p>` : ""}</section>`;
  }
  async function rankRefHtml() {                                         // 순위 숫자 없이 공식 참고자료로만 안내
    const d = await loadRankRefs();
    const items = d.items.filter(x => x.for_rank_reference);
    return `<section class="refbox" id="rank-refs" data-rankrefs="${items.length}"><h2>대학 순위·평가를 보고 싶다면</h2>
      <p class="side">소명지도는 대학 순위 숫자를 만들지 않아요. 아래 공식 자료에서 직접 확인하세요. 참고용이에요.</p>
      <ul class="majors">${items.map(x => `<li><a class="job" href="${esc(x.url)}" target="_blank" rel="noopener noreferrer"><span class="name">${esc(x.provider)}</span><span class="sub">출처: ${esc(x.provider)} · 발표(공시)연도: ${esc(x.year_note)} · 해마다 한 번 갱신되는 공시를 기준으로 봐요</span></a></li>`).join("")}</ul>
      <p class="side">${esc(items[0] ? items[0].limitation : "")} 이용허락 유형은 화면에서 확인하지 못했어요(확인 불가).</p></section>`;
  }
  async function viewChristian() {
    const [chr, pend, her, pa] = await Promise.all([loadChristian(), loadChrPend(), loadHeresy(), loadPaths()]);
    const byCode = new Map([...pa.schools.values()].map(s => [s.code, s]));
    const href = code => byCode.has(code) ? `#/school/${byCode.get(code).idx}` : /^k12-/.test(code) ? `#/k12/${code}` : /^org-/.test(code) ? `#/org/${code}` : /^neis-/.test(code) ? `#/sschool/${code}` : "";   // 대학·초중고·기관·특수학교 코드별 상세
    const link = (code, name) => href(code || "") ? `<a class="job" href="${esc(href(code))}"><span class="name">${esc(name)}</span></a>` : `<span class="name">${esc(name)}</span>`;
    const ver = [...chr.values()].sort((a, b) => collator.compare(a.name, b.name));
    const hn = (her.items || []).length;
    const heresyOf = code => (her.items || []).find(i => i.code === code);
    const verLi = i => `<li data-code="${esc(i.code)}">${link(i.code, i.name)}<p class="tags">${chrTags(i)}</p>${i.denomination && !/^미확인/.test(String(i.denomination).trim()) ? `<p class="side">교단: ${esc(i.denomination)}</p>` : ""}${heresyOf(i.code) ? `<p class="side" data-heresy-line="1">공식 결의 조사: ${esc(heresyOf(i.code).result)}</p>` : ""}<p class="side">근거(${esc(i.evidence_kind)}): “${esc(i.quote)}”</p></li>`;
    const prot = ver.filter(isProt), faithSecs = [["가톨릭", "가톨릭"], ["성공회", "성공회"], ["삼육(제칠일안식일예수재림교)", "삼육"]].map(([k, t]) => [k, t, ver.filter(i => faithOf(i) === k)]).filter(x => x[2].length)
      .map(([k, t, arr]) => `<h2>${t} 학교·기관 확인 <span class="count" data-n="${arr.length}" data-faith-count="${esc(k)}">${arr.length}곳</span></h2><p class="side">${k === "삼육(제칠일안식일예수재림교)" ? "삼육 학교는 학교법인 삼육학원이 제칠일안식일예수재림교의 교육 이념에 따라 운영해요. 개신교와 같은 표시로 묶지 않고 실제 교단 이름으로 따로 보여 드려요." : `기독교(개신교) 학교와 섞지 않고, 학교가 밝힌 실제 소속대로 따로 보여 드려요.`}</p><ul class="majors" id="chr-faith-${esc(t)}">${arr.map(verLi).join("")}</ul>`).join("");
    const heresy = hn ? `<section class="refbox" id="heresy-list" data-heresy="${hn}"><h2>교단 공식 결의 조사 범위</h2>${her.scope_read ? `<p class="side">${esc(her.scope_read)}</p>` : ""}${her.scope_unread ? `<p class="side">${esc(her.scope_unread)}</p>` : ""}
      <p class="side">조사한 ${hn}건 모두 '${esc(her.items[0].result)}'.</p>${her.note ? `<p class="side">${esc(her.note)}</p>` : ""}</section>` : "";
    return { title: "기독교 학교 확인 현황", html: `${crumbs([["처음", "#/"], ["기독교 학교 확인 현황"]])}<h1 tabindex="-1">기독교 학교 확인 현황</h1>
      <p class="lead">학교가 직접 밝힌 공식 글로 기독교 학교임을 확인한 곳과, 아직 확인 중인 곳을 나눠 보여 드려요. 학교의 좋고 나쁨은 말하지 않아요.</p>
      <h2>확인한 기독교(개신교) 학교·기관 <span class="count" data-n="${prot.length}">${prot.length}곳</span></h2>
      <ul class="majors" id="chr-verified">${prot.map(verLi).join("")}</ul>
      ${faithSecs}
      <h2>확인 중인 항목 <span class="count" data-n="${pend.length}">${pend.length}건</span></h2>
      ${pend.length ? `<p class="side">같은 학교가 재단·학과 같은 다른 항목으로 한 번 더 나오기도 해서, 서로 다른 학교는 ${new Set(pend.map(i => i.name)).size}곳이에요.</p>
      <p class="notice">아직 기독교 학교로 확인된 것이 아니에요. 확인되기 전에는 기독교 학교라고 단정하지 않아요.</p>
      <ul class="majors" id="chr-pending">${pend.map(i => `<li data-code="${esc(i.code || "")}">${link(i.code, i.name)}<br><span class="sub">확인 중인 부분: ${esc(i.claim)}${i.school_verified ? " · 이 학교의 학교 소개는 위에서 확인했어요" : ""}</span></li>`).join("")}</ul>` : `<p class="side">위의 기독교 학교·기관(${prot.length}곳)은 학교·기관이 밝힌 글로 확인했어요. 근거 문구의 종류(건학이념·학교 소개·운영 주체 등)는 곳마다 다르고 각 줄에 적어 두었어요. 기독교 학교로 분류한 자료만 있고 공식 글로 아직 확인하지 못한 학교·기관은 이 목록에 넣지 않고, 각 학교·기관 화면에 따로 안내해요.</p>`}
      ${heresy}<p class="side">소속과 신앙 내용은 학교에 직접 확인하세요.</p>` };
  }
  const HELP_CHECKED = "2026-10-21";
  function viewHelp() {
    const ext = (href, label) => `<a class="btn help-go" href="${href}" target="_blank" rel="noopener noreferrer">${label} ↗<span class="sr-only"> (새 창으로 열려요)</span></a>`;
    const item = (badge, title, lines, links, src) => `<li class="help-card"><header class="sc-head"><span class="sc-type">${badge}</span></header><div class="help-body"><h2>${title}</h2><ul class="help-lines">${lines.map(x => `<li>${x}</li>`).join("")}</ul><p class="help-links">${links}</p><p class="side help-src">확인한 곳: ${src} · ${HELP_CHECKED} 확인</p></div></li>`;
    return { title: "도움받기", html: `${crumbs([["처음", "#/"], ["도움받기"]])}
      <h1 tabindex="-1">도움받기</h1>
      <p class="lead">고민이 커질 때는 혼자 풀지 않아도 돼요. 믿을 수 있는 공식 상담 창구를 모아 안내해요.</p>
      <p class="side">아래는 각 기관이 직접 운영하는 공식 사이트로 이어 주는 안내예요. 여기에서 쓴 글자나 눌러 본 내용은 저장하거나 보내지 않아요.</p>
      <p class="side">소명지도는 상담·진단·치료를 하지 않아요. 아래 곳들도 진단이나 치료를 대신해 주는 안내가 아니라, 각 기관의 공식 사이트로 이어 주는 길잡이예요.</p>
      <ul class="help-cards">
        ${item("진로가 고민될 때", "커리어넷 진로상담", [
          "중·고등학생, 학부모, 대학생 등이 진로 고민을 적어 신청할 수 있어요. 학부모는 자녀의 진로 고민으로 신청할 수 있다고 안내돼요.",
          "문의 유형에 ‘진로적응(불안, 자신감 부족, 진로변경, 진로갈등 등)’이 있고, 심화 상담 유형에 ‘특수학생(장애인)’이 있어요.",
          "신청서를 쓰려면 로그인이 필요하다고 안내돼요. 초등학생은 주니어 커리어넷의 진로상담을 이용하라고 안내돼요."],
          ext("https://www.career.go.kr/cloud/w/counsel/insert", "진로상담 신청 보기") + ext("https://www.career.go.kr/cloud/w/counsel/list", "다른 상담 사례 보기"),
          "커리어넷(운영: 한국직업능력연구원 국가진로교육연구센터, 지원: 교육부 — 사이트 하단 안내)")}
        ${item("마음이나 관계가 힘들 때", "청소년상담 1388 채팅상담실", [
          "회원가입과 로그인 후 온라인 청소년상담자와 1:1 실시간 채팅 상담을 할 수 있다고 안내돼요.",
          "사이트에 ‘24시간 언제나 여러분과 함께 합니다’라고 적혀 있어요.",
          "이용은 무료예요. 다만 통신환경에 따라 데이터 통화료나 문자요금이 생길 수 있다고 안내돼요."],
          ext("https://www.1388.go.kr/cco/YTOSP_SC_CCH_01", "채팅상담실 보기") + ext("https://www.1388.go.kr/", "청소년1388 첫 화면"),
          "청소년1388(www.1388.go.kr)")}
        ${item("디지털 생활이 고민될 때", "스마트쉼센터 디지털 생활 상담", [
          "본인이나 가족, 지인이 스마트폰 사용 때문에 상담이나 조언이 필요하면 온라인 상담, 센터 내방 상담, 가정방문 상담으로 도움받을 수 있다고 안내돼요.",
          "전화 상담은 사이트에 ‘전국대표 상담전화 1599-0075’로 적혀 있어요. 운영 시간은 사이트에서 확인해 주세요.",
          "센터를 직접 찾아가는 상담은 일정에 따라 최대 3주까지 기다릴 수 있다고 안내돼요."],
          ext("https://www.iapc.or.kr/contents.do?cid=50&idx=11", "상담 이용안내 보기"),
          "스마트쉼센터(www.iapc.or.kr, 한국지능정보사회진흥원)")}
        ${item("많이 힘들거나 급할 때", "보건복지부 안내 전화", [
          "보건복지부 첫 화면에 ‘보건복지상담센터 국번없이 129(무료)’와 ‘자살예방상담전화 109’가 안내돼 있어요.",
          "지금 안전이 위험하다고 느끼면 곁에 있는 어른에게 바로 알리고, 긴급할 때는 112나 119에 연락하세요(일반 안전 안내예요)."],
          ext("https://www.mohw.go.kr/", "보건복지부 홈페이지 보기"),
          "보건복지부(www.mohw.go.kr) 첫 화면")}
        ${item("기독교 상담이 필요할 때", "백석상담센터 (백석대학교)", [
          "기독교 정신을 바탕으로 만남과 치유, 변화와 성장을 돕는 상담 기관이라고 소개돼요.",
          "개인상담(진로상담 포함), 부부·가족상담, 집단상담이 있어요.",
          "전화(02-520-0824), 방문, 온라인으로 접수한다고 안내돼요. 온라인 신청은 로그인 후 이용할 수 있어요."],
          ext("https://community.bu.ac.kr/bscckorea/6982/subview.do", "센터 이용안내 보기") + ext("https://community.bu.ac.kr/bscckorea/index.do", "센터 첫 화면"),
          "백석상담센터(community.bu.ac.kr/bscckorea, 백석대학교 · 개신교 대학)")}
        ${item("예술로 마음을 돌볼 때", "한세통합예술상담센터 (한세대학교)", [
          "음악과 미술 같은 예술 활동으로 마음을 돌보는 프로그램을 안내해요.",
          "장애 아동과 일반 이용자가 함께 대상이라고 적혀 있고, 음악심리상담은 일반 이용자가 대상이에요.",
          "경기 군포시 한세대학교 로뎀관 1층에 있고, 전화는 031-450-5195예요."],
          ext("https://hansei.ac.kr/view.do?no=11960", "센터 안내 보기"),
          "한세대학교 홈페이지(hansei.ac.kr · 개신교 대학)")}
      </ul>
      <section class="help-note"><h2>믿는 어른과 함께</h2>
        <p>가족, 학교 선생님, 교회의 목사님이나 교사님처럼 믿을 수 있는 어른에게 먼저 이야기해 보는 것도 좋아요.</p>
        <p class="side">전화번호와 운영 방식은 바뀔 수 있으니 각 공식 사이트에서 다시 확인해 주세요.</p></section>
      ` };
  }
  async function viewTerms() {
    const t = await loadTerms();
    return { title: "이 도구를 쓰기 전에", html: `${crumbs([["처음", "#/"], ["이 도구를 쓰기 전에"]])}<h1 tabindex="-1">이 도구를 쓰기 전에</h1>
      <ul class="majors" id="terms-short">${t.short.map(x => `<li>${esc(x)}</li>`).join("")}</ul>
      ${t.sections.map(sec => `<section class="termsec" data-no="${sec.no}"><h2>${sec.no}. ${esc(sec.title)}</h2>${termsLines(sec.lines)}</section>`).join("")}` };
  }
  function termsLines(lines) {                                           // 문서의 '- ' 목록은 목록으로, 나머지 줄은 문단으로(글자는 그대로)
    let out = "", open = false;
    for (const l of lines) {
      if (/^- /.test(l)) { if (!open) { out += "<ul>"; open = true; } out += `<li>${esc(l.slice(2)).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")}</li>`; }
      else { if (open) { out += "</ul>"; open = false; } out += `<p>${esc(l).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")}</p>`; }
    }
    return out + (open ? "</ul>" : "");
  }

  const HERO_ALT = "청소년들이 서로 돕고 걸어가요. 한 친구는 어르신께 바구니를 건네고, 휠체어를 탄 친구와 웃음을 나누고, 한 친구가 태블릿으로 그린 빛이 길을 따라 이어져요. 친근한 협동 로봇이 청소년과 주먹 인사를 하며 함께 걷고, 길 끝 밝은 언덕에는 십자가가 서 있어요. 앞쪽 바위 위에는 성경이 펼쳐져 있고, 멀리 햇살 아래 친환경 배움 공간이 보여요.";
  function viewHome() {
    const card = (href, n, badge, who, title, desc, tags, go, alt) => `<li><a class="entry sc" href="${href}"><header class="sc-head"><span class="sc-type">${badge}</span><span class="sc-no" aria-hidden="true">0${n}</span></header><span class="eart"><img src="assets/home-card-${n}.webp" alt="${alt}" width="800" height="600" decoding="async"></span><div class="sc-body"><em class="who">${who}</em><strong>${title}</strong><span class="edesc">${desc}</span><span class="sc-tags" aria-label="이 기능에서 살펴보는 것">${tags.map(x => `<span class="sc-tag">${x}</span>`).join("")}</span><em class="go">${go}</em></div></a></li>`;
    return { title: "소명지도", html: `
      <section class="h2-hero" aria-labelledby="h2-title">
        <div class="h2-copy">
          <h1 id="h2-title" tabindex="-1">소명지도</h1>
          <p class="h2-head">내게 주신 은사에서 시작해,<br>앞으로 걸어갈 길을 찾아요</p>
          <p class="h2-sub">아직 정해지지 않은 앞날도 괜찮아요.<br>직업·학과·학교,<br>특수교육까지 열려 있는 길을 하나씩 살펴봐요.</p>
          <form class="h2-search" id="home-search" role="search" action="#/search">
            <label class="sr-only" for="hs-q">찾고 싶은 이름</label>
            <input type="search" id="hs-q" placeholder="예: 사회복지사, 특수교육, 나사렛" autocomplete="off" maxlength="40">
            <label class="sr-only" for="hs-kind">찾을 종류</label>
            <select id="hs-kind"><option value="job">직업</option><option value="major">학과</option><option value="school">학교</option><option value="org">기관</option></select>
            <button type="submit" class="btn">찾기</button>
          </form>
          <p class="h2-quick"><span>둘러보기</span><a class="chip" href="#/jobs">직업 모두 보기</a><a class="chip" href="#/search/major">학과</a><a class="chip" href="#/search/school">학교</a><a class="chip" href="#/search/org">기관</a></p>
        </div>
        <figure class="h2-art sc-frame"><img src="assets/calling-map-og-v6-transparent.png" width="1200" height="630" alt="책에서 펼쳐지는 다양한 소명의 길을 청소년이 바라보는 모습" decoding="async"></figure>
      </section>
      <h2 class="h2-start">무엇을 도와드릴까요?</h2>
      <ul class="entrances">
        ${card("#/gifts", 1, "은사에서 시작", "은사 검사를 마쳤다면", "달란트로드로 찾기", "은사 검사 결과로 나에게 맞는 직업과 진로의 길을 살펴봐요.", ["은사 8가지", "3가지 고르기", "56가지 조합"], "은사 3가지 고르러 가기 →", "소명 코치와 청소년이 검사 결과지를 함께 보며 진로 이야기를 나누는 모습")}
        ${card("#/search", 2, "이름으로 찾기", "이름이나 분야를 알고 있다면", "직접 검색하기", "궁금한 직업·학과·학교·기관을 이름으로 검색해 찾아봐요.", ["직업", "학과", "학교", "기관"], "이름으로 검색하러 가기 →", "도서관에서 사서가 찾는 자료를 안내해 주는 모습")}
        ${card("#/special", 3, "특수교육 길잡이", "장애 학생 가족·특수교육 관계자라면", "특수학급·특수학교 찾기", "우리 지역의 특수학교와 특수학급이 있는 학교를 찾아요.", ["특수학교", "특수학급"], "우리 지역 학교 찾으러 가기 →", "특수교사가 휠체어를 탄 학생과 맞춤 교구로 함께 공부하는 모습")}
        ${card("#/help", 4, "도움 받기", "힘들거나 도움이 필요하다면", "도움받기", "힘들거나 진로가 고민될 때,<br>함께 이야기할 곳을 찾아봐요.", ["진로상담", "청소년상담", "디지털 생활 상담"], "상담 창구 보러 가기 →", "학교 상담실에서 상담사가 청소년의 이야기를 따뜻하게 들어 주는 모습")}
      </ul>
      <section class="h2-about">
        <figure class="h2-art-m"><img src="assets/calling-map-og-v6-transparent.png" width="1200" height="630" loading="lazy" decoding="async" alt="책에서 펼쳐지는 다양한 소명의 길을 청소년이 바라보는 모습"></figure>
        <div><p class="lead">소명지도는 십자가의 복음 위에서, 하나님이 은혜로 주신 은사를 살펴보고 진로와 소명의 가능성을 찾아 가는 길잡이예요. 어느 교단에도 치우치지 않는 초교파 길잡이로, 성경이 말하는 소명을 바탕에 둬요.</p>
        <figure class="h2-verse"><blockquote><p>너희는 더욱 큰 은사를 사모하라 내가 또한 가장 좋은 길을 너희에게 보이리라</p></blockquote><figcaption>고린도전서 12:31 · 개역개정</figcaption></figure>
        </div>
      </section>
      <nav class="h2-links" aria-label="안내 바로가기"><a href="#/christian">기독교 학교 확인 현황</a></nav>
      ` };
  }

  const jobCard = r => `<li><a class="jcard" href="${esc(r.href)}"><span class="jthumb"><img src="${esc(r.art)}" width="800" height="600" alt="" loading="lazy" decoding="async"${r.own ? ` onerror="this.onerror=null;this.src='${esc(r.fb)}'"` : ""}><span class="jno" aria-hidden="true">#${String(r.no).padStart(3, "0")}</span>${r.field ? `<span class="jfield">${esc(r.field)}</span>` : ""}</span><span class="jname">${esc(r.name)}</span>${r.sub ? `<span class="jsub">${esc(r.sub)}</span>` : ""}</a></li>`;

  async function viewGifts() {                                             // #/gifts — 검사를 마친 사람이 결과표의 은사 3가지를 직접 고른다(저장·전송 없음)
    const n = st.picked.size, key = GIFT_ORDER.filter(g => st.picked.has(g)).sort().join("+");
    const chips = GIFT_ORDER.map(g => `<button type="button" class="chip" data-gift="${g}" aria-pressed="${st.picked.has(g)}">${esc(GIFT[g])}</button>`).join("");
    const pt = st.ptype, hasType = TYPES.includes(pt);                     // MBTI 는 선택 — "" 안 고름 · "?" 모르겠어요 · 16유형 중 하나
    const mbtiBtns = TYPES.map(t => `<button type="button" class="chip" data-mbti="${t}" aria-pressed="${pt === t}">${t}</button>`).join("");
    const go = `#/mine/r/${esc(key)}${hasType ? "/" + pt : ""}`;          // 은사 3개 + (고른 MBTI) 결과로 한 번에
    const mbtiText = hasType ? pt : pt === "?" ? "모르겠어요(유형 없이 보기)" : "아직 안 고름(선택)";

    let resultSection = "";
    if (n === 3) {
      try {
        const sc = await loadScope();
        const c = sc.combos.get(key);
        if (c) {
          const noMap = new Map([...sc.jobs].map(j => j.id).sort().map((id, i) => [id, i + 1]));
          const comboJobs = c.job_ids.map(id => sc.byId.get(id)).filter(Boolean);
          const cardItems = comboJobs.map(j => jobCard({
            name: j.name,
            href: "#/job/" + j.id,
            cats: [j.field],
            field: j.field,
            no: noMap.get(j.id) || 0,
            art: pokeArtSrc(j),
            own: pokeOwnArt(j),
            fb: pokeFallbackSrc(j),
            sub: j.linked ? `학과 ${j.majorCount}개` : ""
          }));
          resultSection = `
            <section class="gift-preview" style="margin-top:28px; padding-top:24px; border-top:2px solid #e2e8f0;" aria-label="추천 직업">
              <h2 style="font-size:22px; color:#0f172a; margin-bottom:8px;">🎯 이 은사 조합의 추천 직업: <strong style="color:#2563eb;">${esc(c.title)}</strong> <span class="count">${comboJobs.length}개</span></h2>
              <p class="lead" style="margin-bottom:12px;">${esc(giftsText(key))}</p>
              <p class="side" style="margin-bottom:16px;">선택하신 3가지 은사에 맞는 대표 직업들이에요. 카드를 눌러 상세 정보와 배움의 길(학과·학교)을 확인하세요.</p>
              <p style="margin-bottom:20px;"><a class="btn primary" href="${go}" style="display:inline-flex; align-items:center; gap:6px; font-weight:700; padding:12px 22px;">${hasType ? `MBTI ${pt}로 상세 결과 및 배움의 길 보기 →` : "이 3가지로 상세 결과 및 배움의 길 보기 →"}</a></p>
              <ul class="job-grid">${cardItems.join("")}</ul>
            </section>
          `;
        }
      } catch (e) { }
    }

    return { title: "달란트로드 결과로 찾기", html: `${crumbs([["처음", "#/"], ["달란트로드 결과로 찾기"]])}
      <h1 tabindex="-1">내 은사 3가지를 골라 주세요</h1>
      <p class="lead">달란트로드 검사를 마쳤다면 결과표에 나온 은사 3가지를 그대로 눌러 주세요. MBTI 유형을 알면 함께 골라 주세요. 고른 조합에 맞는 직업과 배움의 길로 바로 가요.</p>
      <h2 style="margin-top:20px;">① 은사 3가지 고르기 <span class="count">${n}/3</span></h2>
      <div class="chips" role="group" aria-label="은사 8가지 중 3가지 고르기">${chips}</div>
      <div class="mbti-head"><h2>② MBTI 유형 고르기 <span class="count">선택</span></h2><button type="button" class="chip" data-mbti="?" aria-pressed="${pt === "?"}">모르겠어요</button></div>
      <p class="side">MBTI 16가지 중 내 유형을 눌러 주세요. 모르면 ‘모르겠어요’를 누르거나 그냥 두어도 결과를 볼 수 있어요. 은사보다 먼저 골라도 돼요.</p>
      <div class="typegrid mbti-inline" role="group" aria-label="MBTI 16유형 중 하나 고르기">${mbtiBtns}</div>
      <p class="side" role="status" aria-live="polite" data-gift-count id="gift-go" style="margin-top:12px;">고른 은사: <strong>${n ? esc(key.split("+").map(g => GIFT[g]).join(" · ")) : "없음"}</strong> (${n}/3) · MBTI: <strong>${esc(mbtiText)}</strong>${n === 3 ? "" : ` — 은사 ${3 - n}가지를 더 골라 주세요.`}</p>
      <p>${n === 3 ? `<a class="btn" id="gift-next" href="${go}" style="display:inline-flex; align-items:center; gap:6px; word-break:keep-all;">${hasType ? `MBTI ${pt}로 결과 보기 →` : "은사 3가지로 결과 보기 →"}</a>` : `<button type="button" class="btn" id="gift-next" disabled>은사 3가지를 먼저 골라 주세요</button>`}${n || pt ? ` <button type="button" class="btn ghost" id="gift-reset">다시 고르기</button>` : ""}</p>
      ${resultSection}
      <h2 style="margin-top:32px;">아직 검사를 하지 않았어요</h2>
      <p class="side">검사 없이 은사를 짐작해서 고르지 않아도 괜찮아요. 달란트로드에서 먼저 검사해 보세요.</p>
      <p><a class="btn ghost" href="${TALENTROAD}" rel="external">달란트로드 검사하러 가기 ↗</a></p>` };
  }

  async function viewTypes(key) {
    const { combos } = await loadScope();
    const c = combos.get(key);
    if (!c) return await viewGifts();
    const typeLinks = TYPES.map(t => `<li><a class="chip" href="#/mine/r/${esc(key)}/${t}">${t}</a></li>`).join("");
    return { title: c.title, html: `${crumbs([["처음", "#/"], ["내 검사 결과로 찾기", `#/mine/r/${esc(key)}`], [c.title]])}
      <div class="mbti-head"><h1 tabindex="-1">내 MBTI 유형을 골라 주세요</h1><a class="btn ghost" href="#/mine/r/${esc(key)}">모르겠어요</a></div>
      <p class="lead"><strong>${esc(c.title)}</strong> · ${esc(giftsText(key))}</p>
      <p class="side">MBTI 16가지 중 내 유형을 눌러 주세요. 모르면 ‘모르겠어요’를 눌러도 결과를 볼 수 있어요.</p>
      <ul class="typegrid" aria-label="MBTI 16유형">${typeLinks}</ul>` };
  }

  /* 은사 조합과 닮은 성경 인물 — 본문(사실)·이 앱의 풀이(해석)·오늘의 적용을 소제목과 꼬리표로 나눠 보인다. 인용은 대한성서공회 개역개정 그대로. */
  function bibleCard(b, L) {
    const tag = t => `<span class="tag b56-tag">${esc(t)}</span>`;
    const ev = b.evidence.map(e => `<li><strong>${esc(GIFT[e.gift])}</strong> <a href="${esc(e.url)}" target="_blank" rel="noopener">${esc(e.ref)}</a>${e.level === "p" ? ` <span class="b56-part">부분</span>` : ""}<q>${esc(e.text)}</q>${e.note ? `<small>${esc(e.note)}</small>` : ""}</li>`).join("");
    const ctx = [...b.identity, ...b.context];
    return `<section class="b56" aria-labelledby="b56-h">
        <h2 id="b56-h">이 은사 조합과 닮은 성경 인물</h2>
        <p class="b56-name"><strong>${esc(b.person)}</strong> <span>${esc(b.scene)}</span></p>
        ${b.naming ? `<p class="side">${esc(b.naming)}</p>` : ""}
        ${b.insufficient ? `<p class="notice">근거 부족: 이 조합의 세 은사를 한 인물의 본문에서 모두 뚜렷하게 찾지 못했어요. 가장 가까운 인물을 보여 드려요.</p>` : ""}
        <h3>조합의 특징 ${tag(L.interpretation)}</h3><p>${esc(b.feature)}</p>
        <h3>성경 속 이야기 ${tag(L.fact)}</h3><p>${esc(b.story)}</p>
        <h3>세 은사가 보이는 장면 ${tag(L.fact)}</h3><ul class="b56-ev">${ev}</ul>
        ${ctx.length ? `<details class="more"><summary>함께 읽을 점</summary><ul class="b56-ev">${ctx.map(x => `<li><a href="${esc(x.url)}" target="_blank" rel="noopener">${esc(x.ref)}</a> ${esc(x.note)}${x.text ? `<q>${esc(x.text)}</q>` : ""}</li>`).join("")}</ul></details>` : ""}
        <h3>오늘 해 볼 섬김 ${tag(L.application)}</h3><ul class="b56-serve">${b.serve.map(s => `<li>${esc(s)}</li>`).join("")}</ul>
        <h3>진로 탐색으로 이어 보기 ${tag(L.application)}</h3><p>${esc(b.career)} <button type="button" class="tap b56-jump" data-jump="jobs-h">직업 목록으로 ↓</button></p>
        <h3>이 조합의 말씀</h3><blockquote class="b56-verse"><p>${esc(b.verse.text)}</p></blockquote><p class="side"><a href="${esc(b.verse.url)}" target="_blank" rel="noopener">${esc(b.verse.ref)}</a> (개역개정 · 대한성서공회)</p>
        ${b.reuse ? `<p class="side">${esc(b.reuse)}.</p>` : ""}
        <p class="side">${esc(L.rule)} 성경 인용: 대한성서공회 개역개정(각주 번호만 뺌).</p>
      </section>`;
  }

  async function viewRange(key, type) {
    const sc = await loadScope();
    let b56 = null; try { const bd = await loadBible56(); b56 = bd.byKey.get(key) ? bibleCard(bd.byKey.get(key), bd.labels) : null; } catch (e) { b56 = null; }   // 이 자료가 늦거나 없어도 직업 결과는 그대로 보인다
    const c = sc.combos.get(key);
    if (!c) return await viewGifts();
    st.lastRange = location.hash;
    if (st.rangeKey !== key) { st.rangeKey = key; st.fieldsOff = new Set(); st.wide = false; }
    const pa = await loadPaths();
    const cand = c.job_ids.map(id => sc.byId.get(id)).filter(Boolean);
    const candSet = new Set(c.job_ids);
    const majorSet = new Set(), schoolSet = new Set();
    c.job_ids.forEach(id => (pa.jobMajors.get(id) || []).forEach(x => { majorSet.add(x[0]); (pa.majorSchools.get(x[0]) || []).forEach(s => schoolSet.add(s[0])); }));
    const fieldCount = new Map();
    cand.forEach(j => fieldCount.set(j.field, (fieldCount.get(j.field) || 0) + 1));
    const fieldList = c.fields.map(f => f[0]);
    const chips = fieldList.map(f => `<button type="button" class="chip" data-field="${esc(f)}" aria-pressed="${!st.fieldsOff.has(f)}">${esc(f)} ${fieldCount.get(f) || 0}</button>`).join("");
    const on = j => !st.fieldsOff.has(j.field);
    const cellIds = type && c.cells[type] ? c.cells[type] : [];
    const cellJobs = cellIds.map(id => sc.byId.get(id)).filter(j => j && on(j));
    const cellSet = new Set(cellIds);
    const rest = cand.filter(j => !cellSet.has(j.id) && on(j)).sort((a, b) => chrJobFirst(a, b) || Number(b.linked) - Number(a.linked) || collator.compare(a.name, b.name));
    const none = fieldList.every(f => st.fieldsOff.has(f));
    let html = `${crumbs([["처음", "#/"], ["내 검사 결과로 찾기", `#/mine/r/${esc(key)}`], [c.title]])}
      <h1 tabindex="-1">${esc(c.title)}</h1>
      <p class="lead">${esc(giftsText(key))}</p>
      <section class="callcard" aria-label="소명 안내">
        ${st.fromTalent ? `<p class="from">달란트로드 결과로 들어오셨어요. 하나님이 은혜로 주신 은사를 함께 살펴봐요.</p>` : ""}
        <h2>이 은사들은 이런 힘이에요</h2>
        <ul class="giftlines">${key.split("+").map(g => `<li><strong>${esc(GIFT[g])}</strong> ${esc(GIFT_LINE[g])}</li>`).join("")}</ul>
        <h2>길 안내</h2>
        <p class="side">아래는 이 은사들이 쓰일 수 있는 큰 범위예요. 하나의 정답이 아니라 찾아보기 시작하는 기준이에요. 소명은 하나님이 부르시는 것이라서 사람이나 이 도구가 정해 줄 수 없어요. 마음이 가는 직업부터 눌러서 어떤 학과와 학교에서 준비하는지 살펴보세요. 평범한 생업도, 작은 교회를 지키는 삶도 소명의 길이에요.</p>
        <p class="scope">이 조합이 가리키는 큰 범위: 직업 ${cand.length}개 · 관련 학과 ${majorSet.size.toLocaleString("ko-KR")}개 · 학교 ${schoolSet.size.toLocaleString("ko-KR")}곳</p>
      </section>
      ${b56 || ""}
      ${type ? `<p class="side">내 MBTI 유형 <strong>${esc(type)}</strong> · <a class="tap" href="#/mine/t/${esc(key)}">MBTI 유형 바꾸기</a></p>` : `<p class="side">MBTI 유형을 고르면 그 유형에서 소개된 직업이 맨 위에 나와요. <a class="tap" href="#/mine/t/${esc(key)}">MBTI 유형 고르기</a></p>`}
      <h2 id="jobs-h" tabindex="-1">이 은사 조합에서 많이 나오는 분야</h2>
      <div class="chips" role="group" aria-label="분야">${chips}</div>`;
    if (none) html += `<p class="notice">분야를 하나 이상 골라 주세요.</p>`;
    const hasMain = !!(type && cellJobs.length);                         // 주된 목록(내 유형)이 있으면 나머지는 보조 목록으로 작게 — 두 목록은 겹치지 않는다(rest 는 cellSet 을 뺀 것)
    if (hasMain) html += `<section class="joblist main" data-joblist="main"><h2>내 MBTI 유형에서 먼저 살펴볼 직업 <span class="count">${cellJobs.length}개</span></h2><p class="side">달란트로드가 MBTI ${esc(type)} 유형에서 소개한 직업이에요. 살펴보기 시작하기 좋은 자리예요.</p><ul class="jobs primary">${cellJobs.map(jobItem).join("")}</ul></section>`;
    if (rest.length) html += hasMain
      ? `<section class="joblist sub" data-joblist="sub"><h3>이 은사 조합에서 함께 살펴볼 다른 직업 <span class="count">${rest.length}개</span></h3><p class="side">같은 은사 조합에서 소개된 다른 직업이에요. 내 MBTI 유형에서 소개되지는 않았지만 함께 둘러볼 수 있어요. 더 낫거나 덜한 길이라는 뜻은 아니에요.</p><ul class="jobs secondary">${rest.map(jobItem).join("")}</ul></section>`
      : `<section class="joblist main" data-joblist="main"><h2>이 조합에서 소개된 직업 <span class="count">${rest.length}개</span></h2><ul class="jobs primary">${rest.map(jobItem).join("")}</ul></section>`;
    html += `<div class="widen"><button type="button" class="btn ${st.wide ? "" : "ghost"}" id="widen" aria-pressed="${st.wide}">${st.wide ? "좁혀서 보기" : "더 넓게 보기"}</button></div>`;
    if (st.wide) {
      const fieldsOn = fieldList.filter(f => !st.fieldsOff.has(f));
      const same = fieldsOn.flatMap(f => (sc.fields[f] || []).filter(id => !candSet.has(id)).map(id => sc.byId.get(id))).filter(Boolean)
        .sort((a, b) => chrJobFirst(a, b) || Number(b.linked) - Number(a.linked) || collator.compare(a.name, b.name));
      html += `<h2>같은 분야의 다른 직업 <span class="count">${same.length}개</span></h2>${same.length ? `<ul class="jobs">${limit("same", same).map(jobItem).join("")}</ul>${moreBtn("same", same.length)}` : `<p class="side">보여 드릴 직업이 없어요.</p>`}`;
      const adds = sc.jobs.filter(j => j.origin !== "talentroad").sort((a, b) => collator.compare(a.group || "", b.group || "") || collator.compare(a.name, b.name));
      html += `<h2>새로 알아볼 직업 <span class="count">${adds.length}개</span></h2><p class="side">내 MBTI 유형과 직접 이어진 것은 아니에요. 요즘 새로 생기거나 눈여겨볼 직업이에요.</p>`;
      for (const g of Object.keys(GROUP_LABEL)) {
        const list = adds.filter(j => j.group === g);
        if (list.length) html += `<h3>${esc(GROUP_LABEL[g])} <span class="count">${list.length}개</span></h3><ul class="jobs">${limit("add-" + g, list).map(jobItem).join("")}</ul>${moreBtn("add-" + g, list.length)}`;
      }
    }
    return { title: c.title, html };
  }

  /* ---------- 포켓몬 카드형 직업 카드 (전 직업 공통) ----------
     카드에 쓰는 글은 전부 직업 자료에서 온다: 속성=직업 묶음·분야 이름, 직무·이름 뜻=설명문을 문장 단위로 나눈 것(겹치지 않게), 연계 학과=연결 자료, 연봉=자료에 있을 때만, 출처=자료의 원문 주소.
     자료에 없는 것(적성 등)은 만들지 않고 칸을 그리지 않는다. 카드 번호는 직업 자료 순서. */
  /* 일러스트 배정: 전용 그림이 있는 직업(1호)은 그 그림, 나머지는 ①직업 이름의 낱말 ②분야별 그림 묶음에서 직업 번호로 고정 선택(같은 직업은 늘 같은 그림). 그림은 직업 하나를 그린 것이 아니라 분야·일의 분위기를 보여 주는 대표 그림이다. */
  const A = n => `assets/poke_${n}.webp`;
  const POKE_ART_IMG = { "job-008b0d9ecc": A("opt1_studio") };
  const POKE_ART_KEY = [[/펀딩|크라우드/, ["opt2_celebration", "opt3_showcase"]], [/재활용|환경|생태|에너지/, ["field_public"]], [/음식|조리|요리|식품/, ["sample_opt3", "field_art"]], [/국제|해외|글로벌/, ["field_public", "sample_opt2"]], [/방송|PD|영상|스트리밍|라이브|유튜|크리에이터|미디어|콘텐츠/, ["job_pd"]], [/동물|반려|수의|펫|간호|의사|치료|보건|의료|건강|재활(?!용)/, ["field_health"]],
    [/교육|교사|강사|멘토|코치|학습|훈련|교수/, ["field_edu"]], [/디자이|작가|화가|음악|공예|예술|공연|미술|연출|패션/, ["field_art"]], [/AI|인공지능|데이터|개발|로봇|보안|소프트웨어|프로그래|엔지니어|시스템|정보/, ["field_tech"]],
    [/복지|돌봄|상담|봉사|사회/, ["field_welfare"]], [/공무|행정|도시|안전|정책/, ["field_public"]]];
  const POKE_ART_FIELD = { "경영·창업": ["sample_opt2", "sample_opt3", "sample_opt1"], "AI·기술": ["field_tech", "sample_opt2"], "교육·직업훈련": ["field_edu", "sample_opt3"], "온라인·콘텐츠": ["job_pd", "field_art"], "사회·복지": ["field_welfare", "sample_opt1"],
    "예술·문화": ["field_art", "sample_opt3"], "돌봄·의료·보건": ["field_health", "field_welfare"], "국제·해외": ["field_public", "sample_opt2"], "공공·공익": ["field_public", "sample_opt1"], "": ["sample_opt1", "sample_opt3"] };
  const pokeHash = x => { let h = 0; for (const c of String(x)) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h; };
  /* 직업별 고유 그림: assets/jobs/<id>.webp 가 있는 직업(assets/jobs/manifest.js 의 JOB_ART 목록)은 그 그림, 아직 없는 직업은 위의 대표 그림. */
  const JOB_ART = new Set(window.JOB_ART || []);
  const pokeOwnArt = j => JOB_ART.has(j.id);
  const pokeFallbackSrc = j => {
    if (POKE_ART_IMG[j.id]) return POKE_ART_IMG[j.id];
    const hit = POKE_ART_KEY.find(k => k[0].test(j.name)), pool = hit ? hit[1] : (POKE_ART_FIELD[j.field] || POKE_ART_FIELD[""]);
    return A(pool[pokeHash(j.id) % pool.length]);
  };
  const pokeArtSrc = j => pokeOwnArt(j) ? `assets/jobs/${j.id}.webp` : pokeFallbackSrc(j);
  const pokeArt = j => { const own = pokeOwnArt(j), sym = POKE_ART_IMG[j.id];
    return `<img class="poke-art-img" src="${pokeArtSrc(j)}" width="${own ? 640 : 1200}" height="${own ? 480 : 896}" alt="${esc(own || sym ? j.name + (own ? " 그림" : " 상징 그림") : (j.field || "직업") + " 분야 대표 그림")}" loading="lazy" decoding="async"${own ? ` onerror="this.onerror=null;this.src='${pokeFallbackSrc(j)}'"` : ""}><figcaption>${own ? "이 직업을 그린 그림이에요." : sym ? "소명지도 상징 그림이에요." : "분야 대표 그림이에요."}</figcaption>`; };
  /* 직업명과 설명문 주어 대조: 커리어넷 연결이 다른 직업 설명으로 이어진 직업(예: 프로그램디렉터→개그맨)을 가려낸다.
     ok=주어가 같거나 주어가 없는 직접 쓴 설명 / similar=핵심 단어가 겹치는 비슷한 직업 / mismatch=다른 직업. 주어는 첫 문장이 '○○는'으로 시작하고 명사구일 때만 인정한다. */
  const POKE_GEN = "(전문가|관리자|관리사|관리원|컨설턴트|연구원|연구자|기획자|기획가|책임자|디렉터|코디네이터|상담사|상담가|교사|강사|디자이너|기술자|담당자|담당|매니저|개발자|엔지니어|운영자|행정가|제작자|지도자|교수|사|원|가|자)$";
  const pokeNorm = x => String(x || "").replace(/\([^)]*\)|[\s·ㆍ,]/g, ""), pokeFlat = x => String(x || "").replace(/[\s·ㆍ,()]/g, "");
  function pokeSubject(d) {
    const first = String(d || "").trim().split(/(?<=다\.)\s+/)[0], m = /^(.{2,20}?)(은|는)\s/.exec(first);
    if (!m) return "";
    if (/(하는|되는|시키는|있는|하여|위해|통해|따라|및|또|의\s|에서|에게|으로|을\s|를\s|이\s|가\s|이나)/.test(m[1] + m[2]) || pokeNorm(m[1]).length > 14) return "";
    return m[1].trim();
  }
  const pokeHead = x => { const re = new RegExp(POKE_GEN); let h = pokeNorm(x); h = h.replace(re, "").replace(re, ""); return h || pokeNorm(x); };
  function pokeLcs(a, b) { let best = 0; for (let i = 0; i < a.length; i++) for (let k = 0; k < b.length; k++) { let n = 0; while (i + n < a.length && k + n < b.length && a[i + n] === b[k + n]) n++; best = Math.max(best, n); } return best; }
  function pokeMatch(name, desc) {
    const subject = pokeSubject(desc);
    if (!subject) return { state: "ok", subject: "" };
    const n = pokeFlat(name), sn = pokeFlat(subject), n2 = pokeNorm(name), s2 = pokeNorm(subject);
    if (sn.includes(n) && sn.length - n.length >= 2) return { state: "similar", subject };          // 일반 이름(공무원)에 구체 하위 직업(행정부고위공무원) 설명이 붙은 경우: 같은 직업으로 보지 않는다
    if (n.includes(sn) || sn.includes(n) || n2.includes(s2) || s2.includes(n2)) return { state: "ok", subject };
    const hn = pokeHead(name), hs = pokeHead(subject);
    return { state: pokeLcs(hn, hs) >= 2 ? "similar" : "mismatch", subject };
  }
  function pokeJobCard(j, no, ms, pa) {
    const mt = pokeMatch(j.name, j.description);
    const sents = String(j.description || "").split(/(?<=다\.)\s+/).map(x => x.trim()).filter(Boolean);
    const duty = sents.length > 1 ? sents[sents.length - 1] : sents[0] || "", meaning = sents.length > 1 ? sents.slice(0, -1).join(" ") : "";
    const list = ms.map(([mid, rows]) => ({ mid, rows, name: (pa.majorById.get(mid) || {}).name || "" })).filter(m => m.name).sort((a, b) => b.rows - a.rows || collator.compare(a.name, b.name));
    const type = GROUP_LABEL[j.group] || j.field || "직업", num = String(no).padStart(3, "0");
    const host = (() => { try { return new URL(j.sourceUrl).hostname; } catch (e) { return ""; } })();
    const srcName = host.endsWith("career.go.kr") ? "커리어넷" : "달란트로드";
    const wage = j.wage && mt.state === "ok" ? `<div class="poke-row"><span class="poke-badge wage">연봉</span><span class="poke-text">평균 <b>${esc(j.wage)}만원</b> (출처: 커리어넷)</span></div>` : "";
    const dutyRow = mt.state === "ok" ? (duty ? `<div class="poke-row" data-poke-sec="duty"><span class="poke-badge duty">핵심 직무</span><span class="poke-text">${esc(duty)}</span></div>` : "")
      : mt.state === "similar" ? `<div class="poke-row" data-poke-sec="related"><span class="poke-badge duty">관련 직무 참고</span><span class="poke-text">커리어넷의 비슷한 직업 ‘${esc(mt.subject)}’ 설명이에요. ${esc(duty)}</span></div>`
      : `<div class="poke-row" data-poke-sec="pending"><span class="poke-badge duty">안내</span><span class="poke-text">관련 직무 상세 자료를 정비하고 있어요.</span></div>`;
    const showMeaning = mt.state === "ok" && meaning;
    const link = !j.sourceUrl || mt.state === "mismatch" ? "" : `<a class="poke-btn" href="${esc(j.sourceUrl)}" target="_blank" rel="noopener noreferrer">${mt.state === "similar" ? "비슷한 직업 보기" : srcName + "에서 더 보기"} ↗<span class="sr-only"> (새 창으로 열려요)</span></a>`;
    return `<article class="poke-card" data-poke="job" data-poke-no="${num}" data-poke-match="${mt.state}"><div class="poke-frame">
      <header class="poke-head"><span class="poke-type">${esc(type)}</span><h1 class="poke-name" tabindex="-1">${esc(j.name)}</h1><span class="poke-no"><span aria-hidden="true">#${num}</span><span class="sr-only">카드 번호 ${no}번</span></span></header>
      <figure class="poke-art">${pokeArt(j)}</figure>
      <div class="poke-skill">${dutyRow}${wage}
        ${showMeaning ? `<details class="poke-mean" data-poke-sec="meaning"><summary>이름의 뜻 보기</summary><p>${esc(meaning)}</p></details>` : ""}</div>
      ${list.length ? `<div class="poke-stat" data-poke-sec="stats"><span class="poke-label">연계 학과 <b>${list.length}개</b></span><ul class="poke-majors">${list.slice(0, 3).map(m => `<li><a class="poke-chip" href="#/major/${esc(m.mid)}">${esc(m.name)}</a></li>`).join("")}</ul></div>` : ""}
      ${POKE_CALLING[j.id] ? "" : verseHtml(POKE_VERSES.fields[j.field] || POKE_VERSES.def)}
      <footer class="poke-foot"><span class="poke-src">출처: ${srcName}${mt.state === "mismatch" ? " (자료 정비 중)" : ""}</span>${link}</footer>
    </div></article>`;
  }
  /* 소명 5대 모듈 시범(1호 한 직업만): 아래 문안은 오너가 확정해 준 시범 문안이며 직업 자료(커리어넷)에서 온 값이 아니다. 화면에도 그렇게 밝힌다. 다른 직업은 이 블록이 없다. */
  const POKE_CALLING = { "job-008b0d9ecc": {
    mission: "가치 있는 아이디어와 선한 뜻을 품은 창작자가 재정적 장벽 앞에 좌절하지 않도록, 대중의 신뢰와 사랑의 후원을 연결하여 세상에 필요한 프로젝트를 실현시키는 청지기 사명입니다.",
    gifts: { main: [["다스림", "L", "기획·조정"], ["섬김", "S", "도움·연결"]], sub: [["권위", "C", "설득·소통"], ["지혜", "T", "안목·판단"]], synergy: "사람들의 마음에 공감을 일으키고 프로젝트를 투명하고 정직하게 끝까지 책임지는 달란트가 있을 때 가장 크게 빛납니다." },
    road: { subjects: ["경제", "경영일반", "데이터과학", "사회·문화", "융합사회"], majors: ["경영학", "미디어커뮤니케이션", "광고홍보", "IT융합공학"], acts: ["교내 프로젝트 크라우드펀딩 모의 기획", "스토리텔링 작문 훈련", "플랫폼 서포터 참여 경험"] },
    ethics: "후원금 관리의 투명성과 정직, 과장 광고를 지양하고 창작자와 후원자 모두를 배려하는 신뢰 구축.",
    verse: { ref: "전 11:1", text: "너는 네 떡을 물 위에 던져라 여러 날 후에 도로 찾으리라" },
    prayer: "하나님, 선한 뜻을 품은 이웃들의 작은 씨앗이 풍성한 열매를 맺도록 정직과 사랑으로 돕는 통로가 되게 하소서." } };
  function callingModules(j) {
    const c = POKE_CALLING[j.id];
    if (!c) return "";
    const li = a => `<ul class="cm-list">${a.map(x => `<li>${esc(x)}</li>`).join("")}</ul>`, chips = a => a.map(([n, g, d]) => `<span class="cm-gift"><b>${esc(n)}</b> (${esc(GIFT[g])}) <small>${esc(d)}</small></span>`).join("");
    return `<section class="calling" data-calling="pilot" aria-labelledby="cm-h"><h2 id="cm-h">소명 5대 모듈 <span class="count">시범</span></h2>
      <p class="side">오너가 확정한 시범 문안이에요. 직업 자료에서 가져온 내용이 아니라 소명을 살펴보도록 돕는 글이에요.</p>
      <article class="cm" data-cm="1"><h3><span class="cm-no" aria-hidden="true">1</span>소명 사명문</h3><p class="cm-mission">${esc(c.mission)}</p></article>
      <article class="cm" data-cm="2"><h3><span class="cm-no" aria-hidden="true">2</span>달란트·은사 연계</h3><p class="cm-row"><span class="cm-tag">주은사</span>${chips(c.gifts.main)}</p><p class="cm-row"><span class="cm-tag sub">보조은사</span>${chips(c.gifts.sub)}</p><p>${esc(c.gifts.synergy)}</p></article>
      <article class="cm" data-cm="3"><h3><span class="cm-no" aria-hidden="true">3</span>소명 준비 로드맵</h3><p class="cm-sub">고교 권장과목 <small>(2022 개정 교육과정 기준)</small></p>${li(c.road.subjects)}<p class="cm-sub">실무 추천 전공</p>${li(c.road.majors)}<p class="side">카드 위쪽 ‘연계 학과’는 커리어넷 공공 자료이고, 여기 전공은 실무에서 도움이 되는 추천이라 서로 달라요.</p><p class="cm-sub">준비 활동</p>${li(c.road.acts)}</article>
      <article class="cm" data-cm="4"><h3><span class="cm-no" aria-hidden="true">4</span>크리스천 직업 윤리</h3><p>${esc(c.ethics)}</p></article>
      <article class="cm" data-cm="5"><h3><span class="cm-no" aria-hidden="true">5</span>맞춤 말씀과 결단 기도</h3>${verseHtml(c.verse)}<p class="cm-prayer"><b>결단 기도</b> “${esc(c.prayer)}”</p></article></section>`;
  }
  async function viewJob(id) {
    const sc = await loadScope();
    const j = sc.byId.get(id);
    if (!j) return viewNotFound();
    const pa = await loadPaths();
    st.lastJob = j.id;
    const back = st.origin === "search" ? originCrumb() : st.lastRange && st.lastRange.startsWith("#/mine/r/") ? [["내 범위", st.lastRange]] : [];
    const gf = j.origin === "talentroad" ? jobGifts(sc, j.id) : { gifts: [], kind: "" }, gifts = gf.gifts;
    const line = `${josa(j.name, "은", "는")} ${j.field ? `${esc(j.field)} 분야의 직업이에요.${isChrJob(j) ? "" : ` ${esc(FIELD_HELP[j.field] || "")}`}` : "눈여겨볼 만한 직업이에요."}${j.origin !== "talentroad" && j.group !== "christian_vocation" ? ` 요즘 새로 생기거나 눈여겨보는 직업이에요${GROUP_LABEL[j.group] && j.group !== "emerging_new" ? ` (${esc(GROUP_LABEL[j.group])})` : ""}.` : ""}${gifts.length ? (gf.kind === "few" ? ` 달란트로드에서 ${esc(gifts.join(", "))} 은사 조합으로 소개된 직업이에요.` : ` 달란트로드에서 ${esc(gifts.join(", "))} 은사 조합에 자주 소개되는 직업이에요.`) : ""}`;
    const lineSide = j.origin === "talentroad" ? `달란트로드 56개 은사 조합 가운데 ${sc.appears.get(j.id) || 0}곳에서 소개된 직업이에요.` : "";
    const chrLine = isChrJob(j) ? `<p class="lead chr-job" data-chr-job="1"><span class="tag chr">✝ 사역·선교 직업</span> 하나님이 주신 달란트로 교회와 이웃을 섬기는 소명의 길이에요. 일터에서도 신앙으로 사람을 세우는 일이에요.</p>` : "";
    let html = `${crumbs([["처음", "#/"], ...back, [j.name]])}${pokeJobCard(j, sc.jobs.indexOf(j) + 1, pa.jobMajors.get(j.id) || [], pa)}<p class="lead">${line}</p>${chrLine}${lineSide ? `<p class="side">${esc(lineSide)}</p>` : ""}${callingModules(j)}${jobEnrichHtml(await loadJobEnrichItem(j.id))}`;
    const ms = pa.jobMajors.get(j.id);
    if (!ms || !ms.length) {
      const simData = await loadSimilar();
      const simH = similarHtml(simData.byJob.get(j.id) || [], pa, simData.meta);
      const note = (await loadJobNotes()).items[j.id];
      const noLinkText = ((await loadTerms()).card[1] || "").replace(/^연결이 없는 직업:\s*/, "").replace(/^「|」$/g, "");
      const sameField = j.field ? sc.jobs.filter(x => x.field === j.field && x.linked && x.id !== j.id).sort((a, b) => chrJobFirst(a, b) || collator.compare(a.name, b.name)) : [];                     // 자료 확인 중인 직업(근거 있는 학과가 아직 없음): 만들지 않고 정직하게 표시
      html += note
        ? `<h2>이 직업을 준비하는 길</h2><section class="refbox" data-jobpath="checking"><p class="notice">관련 학과 자료를 확인 중이에요.</p><p class="side">${esc(note.scope)} ${esc(note.careernet)}</p><p class="side">${esc(note.rule)}</p></section>${simH}<p><a class="tap" href="${back.length ? back[0][1] : "#/"}">다른 직업 살펴보기</a></p>`
        : `<h2>이 직업을 준비하는 길</h2><p class="notice" data-jobsrc="none">${esc(noLinkText)}</p>${simH}<p><a class="tap" href="${back.length ? back[0][1] : "#/search/job"}">다른 직업 살펴보기</a></p>`;
      if (sameField.length) html += `<section class="joblist sub" data-samefield="${sameField.length}"><h3>같은 분야(${esc(j.field)})에서 준비하는 길이 정리된 직업 <span class="count">${sameField.length}개</span></h3><ul class="jobs secondary">${limit("samefield", sameField).map(jobItem).join("")}</ul>${moreBtn("samefield", sameField.length)}</section>`;
    } else {
      const list = ms.map(([mid, rows]) => ({ mid, rows, name: (pa.majorById.get(mid) || {}).name || mid })).sort((a, b) => b.rows - a.rows || collator.compare(a.name, b.name));
      if (list.length <= 3) html += `<h2>이 직업을 준비하는 길</h2><p class="side">위 카드의 연계 학과 ${list.length}개를 누르면 그 학과가 있는 학교를 볼 수 있어요.</p>`;
      else html += `<h2>이 직업을 준비하는 길</h2><p class="side">관련 학과를 누르면 그 학과가 있는 학교를 볼 수 있어요. (학과 ${list.length}개)</p>
        <ul class="majors">${limit("majors", list).map(m => `<li><a class="job" href="#/major/${esc(m.mid)}"><span class="name">${esc(m.name)}</span></a></li>`).join("")}</ul>${moreBtn("majors", list.length)}`;
    }
    if (ms && ms.length) {
      const cnt = new Map();                                   // 학교 idx → 이 직업과 이어진 학과 집합
      for (const [mid] of ms) for (const t of pa.majorSchools.get(mid) || []) { if (!cnt.has(t[0])) cnt.set(t[0], new Set()); cnt.get(t[0]).add(mid); }
      const chr = await loadChristian();
      const sl = [...cnt].map(([idx, set]) => ({ s: pa.schools.get(idx), n: set.size })).filter(r => r.s).sort((a, b) => chrSchoolFirst(chr, a.s, b.s) || b.n - a.n || collator.compare(a.s.name, b.s.name));
      html += `<h2>이 직업을 준비할 수 있는 학교 <span class="count">${sl.length.toLocaleString("ko-KR")}곳</span></h2>
        <ul class="majors">${limit("jobschools", sl).map(r => `<li><a class="job" href="#/school/${r.s.idx}"><span class="name">${esc(r.s.name)}</span><span class="sub">${esc([sidoOf(r.s.sido), `관련 학과 ${r.n}개`].filter(Boolean).join(" · "))}</span></a>${chrSchoolTags(chr, r.s)}${chrVision(chr.get(r.s.code))}</li>`).join("")}</ul>${moreBtn("jobschools", sl.length)}`;
    }
    { const [src, terms] = await Promise.all([loadJobSrc(), loadTerms()]); html += jobSourceHtml(src.jobs[j.id], !!(ms && ms.length), terms); }
    html += evidence("직업 정보는 공공기관이 공개한 자료를 모아 정리했어요. 더 자세한 내용은 직업 정보 사이트에서 직접 찾아볼 수 있어요.", "https://career.go.kr", "직업 정보 사이트 열기");
    if (st.origin === "search") html += again();
    return { title: j.name, html };
  }

  async function loadMajorSubjects(mid) {                              // 학과 id 가 든 샤드 하나만 읽는다(공공데이터 표준데이터의 주요교과목명 — 없으면 null)
    const m = D["manifest.json"].shards.major_subjects;
    const sh = m && m.find(x => mid >= x.first_key && mid <= x.last_key);
    if (!sh) return null;
    try { const doc = await file(sh.file); return doc.rows.find(r => r[0] === mid) || null; } catch (e) { return null; }
  }
  /* 과목 이름 끝말(개론·이론·실습 등)만 보고 붙이는 일반 설명. 과목마다 실제 내용은 학교가 달라서, 끝말로 알 수 없는 과목은 설명 없이 이름만 보인다. */
  function subjectInfo(name) {
    const base = name.replace(/\s*([0-9]+|[ⅠⅡⅢⅣⅤ]+|[IV]{1,3})$/, "").trim(), cut = suf => base.slice(0, base.length - suf.length).trim();
    let m;
    if (/현장실습$/.test(base)) return { kind: "practice", desc: "실제 일하는 현장에서 직접 경험하며 배워요." };
    if (/(캡스톤디자인|프로젝트)/.test(base)) return { kind: "practice", desc: "배운 내용을 모아 결과물을 직접 만들어 보는 과목이에요." };
    if (/세미나$/.test(base)) return { kind: "practice", desc: "주제를 정해 발표하고 토론하며 배워요." };
    if (/논문(연구|지도)?$/.test(base)) return { kind: "practice", desc: "논문을 쓰기 위해 한 주제를 깊이 연구하는 과목이에요." };
    if ((m = /(실습|실험)$/.exec(base))) return { kind: "practice", desc: cut(m[1]).length >= 2 ? `${cut(m[1])} 내용을 직접 해 보며 익히는 ${m[1]} 과목이에요.` : `직접 해 보며 익히는 ${m[1]} 과목이에요.` };
    if (/설계$/.test(base)) return { kind: "practice", desc: "무엇을 어떻게 만들지 직접 계획해 보는 과목이에요." };
    if (/(관리|경영|행정)$/.test(base)) return { kind: "practice", desc: `${base} 분야를 어떻게 운영하고 관리하는지 배워요.` };
    if ((m = /(개론|입문|기초|개요)$/.exec(base))) return { kind: "theory", desc: cut(m[1]).length >= 2 ? `${cut(m[1])}의 기본을 처음 배우는 입문 과목이에요.` : "처음 배우는 입문 과목이에요." };
    if ((m = /(원론|이론|론)$/.exec(base)) && cut(m[1]).length >= 2) return { kind: "theory", desc: `${cut(m[1])}의 기본 원리와 이론을 배워요.` };
    if (/[가-힣]{2,}학$/.test(base)) return { kind: "theory", desc: "" };
    return { kind: "other", desc: "" };
  }
  function subjectsHtml(subj) {
    if (!subj || !subj[2].length) return "";
    const g = { core: [], practice: [] };                               // 끝말로 못 나누는 과목(운영체제·자료구조 등)도 전공 과목 카드에 함께 — 자료 순서(많이 나오는 순) 유지
    for (const x of subj[2]) { const i = subjectInfo(x); g[i.kind === "practice" ? "practice" : "core"].push([x, i.desc]); }
    const item = ([n, d]) => `<li class="subj-item"><span class="subj-name">${esc(n)}</span>${d ? `<span class="subj-desc">${esc(d)}</span>` : ""}</li>`;
    const card = (title, sub, list) => list.length ? `<div class="subj-card"><h3>${title}</h3><p class="side">${sub}</p><ul class="subj-list">${list.map(item).join("")}</ul></div>` : "";
    const basis = subj[3] >= 4 ? `여러 학교(${subj[3]}곳)의 교육과정에 자주 나오는 과목 이름이에요.` : `이 학과를 운영하는 일부 학교(${subj[3]}곳 기준)의 과목 이름이에요. 대표 과목이 아니라 예시예요.`;
    return `<section class="refbox" data-block="major-subjects"><h2>무엇을 배우나요?</h2><p class="side">${subj[1] ? `계열 · ${esc(subj[1])}<br>` : ""}${basis} 많이 나오는 과목부터 보여 줘요. 한 줄 설명은 과목 이름의 끝말(개론·이론·실습 등)로 알 수 있는 과목에만 붙인 일반 설명이고, 설명이 없는 과목도 똑같이 중요한 전공 과목이에요. 실제 수업 내용은 학교마다 달라요.</p>
      <div class="subj-grid">${card(`<span aria-hidden="true">📘</span> ${subj[3] >= 4 ? "주요 전공 과목" : "전공 과목 예시"}`, "전공의 기본 개념과 원리, 핵심 지식을 배우는 과목이에요.", g.core)}${card("<span aria-hidden=\"true\">🛠</span> 직접 해 보는 실습·실무 과목", "배운 것을 직접 해 보고 현장을 경험하는 시간이에요.", g.practice)}</div>
      <p class="side">출처: 공공데이터포털 「전국대학별학과정보표준데이터」(한국대학교육협의회)</p></section>`;
  }
  function majorOverviewText(name, field, jobs) {
    /* 이름에 분야 낱말이 둘 이상이면('AI경영학과'=컴퓨터+경영, 'AI·데이터법학과'=컴퓨터+행정) 위에서부터 먼저 걸리는 하나의 설명을 고르면 엉뚱한 학과 소개가 나온다.
       이럴 때는 계열 공통 문장만 보여 준다(자료에 없는 내용을 단정하지 않기). */
    const KW = [/간호/, /의학|의예|한의|치의/, /물리치료|작업치료|임상병리|방사선|치위생|응급구조|재활/, /신학|기독|선교|목회|교회|교역/, /사회복지|지역복지|아동복지|노인복지/, /컴퓨터|소프트웨어|인공지능|AI|데이터|정보통신|보안/, /전자|전기|반도체|정보전자/, /기계|로봇|메카트로닉스|자동차|항공|조선/, /화학|화공|바이오|생명공학|생명과학/, /경영|경제|비즈니스|금융|회계|마케팅/, /교육|유아교육|초등교육|특수교육|국어교육|영어교육|수학교육/, /디자인|시각디자인|산업디자인|영상|애니메이션|웹툰|콘텐츠/, /음악|성악|피아노|실용음악|작곡|국악/, /체육|스포츠|운동|레저/, /행정|법학|경찰|공공/, /심리|상담/];
    /* 'AI'·'데이터'는 다른 학문 앞에 붙는 꾸밈말인 경우가 많다('AI스마트팜융합전공', 'AI MBA'). 컴퓨터·소프트웨어 같은 낱말 없이 'AI'·'데이터'로만 걸렸고
       이름에 다른 학문 낱말이 남아 있으면 IT 학과 소개를 붙이지 않는다. */
    const itWeakOnly = !/컴퓨터|소프트웨어|인공지능|정보통신|보안/.test(name) && /AI|데이터/.test(name) && name.replace(/AI|데이터|빅|사이언스|SW|공학|융합|전공|학과|학부|계열|대학원|심화|학|과|[·&\s]/g, "").length > 0;
    if (itWeakOnly || KW.filter(r => r.test(name)).length > 1) {
      return field ? `${esc(field)} 분야의 핵심 이론과 실무 역량을 기초부터 심화까지 체계적으로 배워요. 전공 지식을 바탕으로 사회 각 분야에서 필요한 전문 인재로 성장할 수 있습니다.` : "해당 분야의 기초 이론과 실무 응용 기술을 체계적으로 학습하며, 전공 지식을 통해 사회와 일터에 기여하는 전문 인재를 양성해요.";
    }
    if (/간호/.test(name)) {
      return "질병을 예방하고 환자의 건강 회복과 안녕을 돕는 전문 간호 지식과 임상 실습을 체계적으로 배워요. 생명 존중과 섬김, 따뜻한 돌봄의 가치를 의료 현장에서 실천하는 전문 의료인을 길러냅니다.";
    }
    if (/의학|의예|한의|치의/.test(name)) {
      return "인체의 구조와 기능, 질병의 원인과 진단, 치료법을 과학적으로 탐구하고 임상 기술을 연마해요. 생명을 살리고 인류의 건강 증진에 헌신하는 전문 의료인을 양성합니다.";
    }
    if (/물리치료|작업치료|임상병리|방사선|치위생|응급구조|재활/.test(name)) {
      return "신체적·정신적 회복이 필요한 이웃을 돕기 위해 전문 치료 기술과 보건 의료 과학을 학습해요. 환자의 일상 복귀와 건강 증진을 돕는 보건의료 전문인으로 성장합니다.";
    }
    if (/신학|기독|선교|목회|교회|교역/.test(name)) {
      return "기독교 신앙의 본질과 기독교의 역사, 교회와 온 세상을 섬기는 실천적 원리를 깊이 탐구해요. 이웃을 돌보고 공동체를 이끌어 가는 헌신적인 사역자와 지도자를 양성합니다.";
    }
    if (/사회복지|지역복지|아동복지|노인복지/.test(name)) {
      return "개인과 가족, 지역사회가 겪는 다양한 문제를 예방하고 삶의 질을 높이는 복지 정책과 실천 기술을 배워요. 도움이 필요한 이웃을 섬기고 더 따뜻한 공동체를 만드는 사회복지 전문가를 양성합니다.";
    }
    if (/컴퓨터|소프트웨어|인공지능|AI|데이터|정보통신|보안/.test(name)) {
      return "컴퓨터 시스템의 원리와 프로그래밍, 데이터 분석, 최신 인공지능 기술을 체계적으로 익혀요. 디지털 대전환 시대에 새로운 가치를 창출하고 문제를 해결하는 IT 소프트웨어 인재를 길러냅니다.";
    }
    if (/전자|전기|반도체|정보전자/.test(name)) {
      return "전기 에너지와 전자 회로, 반도체 및 첨단 하드웨어 시스템의 설계와 제어 원리를 배워요. 첨단 산업의 기반이 되는 핵심 기술을 연구하고 개발하는 전문 공학도를 양성합니다.";
    }
    if (/기계|로봇|메카트로닉스|자동차|항공|조선/.test(name)) {
      return "힘과 에너지의 원리를 이용해 다양한 기계 장치와 자동화 시스템, 미래 모빌리티를 설계하고 제작하는 기술을 배워요. 산업 현장의 생산과 기술 혁신을 이끄는 엔지니어를 양성합니다.";
    }
    if (/화학|화공|바이오|생명공학|생명과학/.test(name)) {
      return "물질의 성질과 생명 현상의 메커니즘을 규명하고, 이를 신약·친환경 에너지·바이오 기술에 응용하는 방법을 연구해요. 미래 과학 기술과 바이오 산업을 이끄는 연구자를 양성합니다.";
    }
    if (/경영|경제|비즈니스|금융|회계|마케팅/.test(name)) {
      return "일터와 조직의 효율적인 운영과 자원 배분, 마케팅 전략과 재무 분석 등 경제 활동 전반의 원리를 학습해요. 급변하는 환경에서 올바른 의사결정으로 가치를 창출하는 전문 경영 인재를 양성합니다.";
    }
    if (/교육|유아교육|초등교육|특수교육|국어교육|영어교육|수학교육/.test(name)) {
      return "배움과 성장의 원리를 이해하고, 교과 전문 지식과 효과적인 교수 학습법을 익혀요. 다음 세대의 바른 성장을 돕고 잠재력을 키워 주는 전문 교사와 교육 전문가를 양성합니다.";
    }
    if (/디자인|시각디자인|산업디자인|영상|애니메이션|웹툰|콘텐츠/.test(name)) {
      return "창의적인 아이디어를 시각적 조형 언어와 디지털 미디어로 구현하는 디자인 실무와 감각을 길러요. 사람들의 마음을 움직이고 소통을 돕는 창의적인 콘텐츠 창작자를 양성합니다.";
    }
    if (/음악|성악|피아노|실용음악|작곡|국악/.test(name)) {
      return "음악적 감성과 연주 기법, 화성학 및 창작 역량을 깊이 있게 연마해요. 아름다운 소리로 세상과 소통하고 감동을 전하는 전문 음악인을 양성합니다.";
    }
    if (/체육|스포츠|운동|레저/.test(name)) {
      return "신체 활동의 과학적 원리와 스포츠 훈련법, 건강 지도 능력을 체계적으로 길러요. 건강한 신체 문화를 보급하고 스포츠 산업을 발전시키는 지도자를 양성합니다.";
    }
    if (/행정|법학|경찰|공공/.test(name)) {
      return "국가와 사회의 공공 정책, 법률 제도, 공공 안전과 조직 운영 원리를 배워요. 정의로운 사회 질서를 유지하고 시민의 삶을 안전하게 지키는 공공 인재를 양성합니다.";
    }
    if (/심리|상담/.test(name)) {
      return "인간의 마음과 행동, 감정의 원리를 과학적으로 탐구하고 전문 상담 기법을 익혀요. 마음의 상처를 치유하고 건강한 일상을 살아가도록 돕는 상담 전문가를 양성합니다.";
    }
    if (field) {
      return `${esc(field)} 분야의 핵심 이론과 실무 역량을 기초부터 심화까지 체계적으로 배워요. 전공 지식을 바탕으로 사회 각 분야에서 필요한 전문 인재로 성장할 수 있습니다.`;
    }
    return "해당 분야의 기초 이론과 실무 응용 기술을 체계적으로 학습하며, 전공 지식을 통해 사회와 일터에 기여하는 전문 인재를 양성해요.";
  }

  async function viewMajor(mid) {
    const pa = await loadPaths();
    const m = pa.majorById.get(mid);
    if (!m) return viewNotFound();
    const sc = await loadScope();
    const job = st.lastJob && sc.byId.get(st.lastJob);
    const menrich = await loadMajorEnrich(), official = majorOfficialHtml(mid, menrich, menrich.map[mid] ? await loadMajorEnrichItems(menrich.map[mid][0]) : null);   // 커리어넷 학과 소개가 있는 학과만(없으면 아래 이름 규칙 분야 안내)
    const rows = new Map();                                   // 학교 idx → {학위 집합}
    for (const t of pa.majorSchools.get(mid) || []) { if (!rows.has(t[0])) rows.set(t[0], new Set()); rows.get(t[0]).add(pa.degrees[t[1]]); }
    let list = [...rows].map(([idx, degs]) => ({ s: pa.schools.get(idx), under: [...degs].some(d => UNDERGRAD.has(d)), grad: [...degs].some(d => !UNDERGRAD.has(d)) })).filter(r => r.s);
    const regions = [...new Set(list.map(r => sidoOf(r.s.sido)).filter(Boolean))]           // 원자료의 '서울'·'서울특별시' 같은 표기를 한 시·도로 묶는다
      .sort((a, b) => ((SIDO_ORDER.indexOf(a) + 1) || 99) - ((SIDO_ORDER.indexOf(b) + 1) || 99) || collator.compare(a, b));
    if (st.region && !regions.includes(st.region)) st.region = "";
    const subj = await loadMajorSubjects(mid);
    const chr = await loadChristian();
    const levelOk = r => !st.level || (st.level === "under" ? r.under : r.grad);
    list = list.filter(r => (!st.region || sidoOf(r.s.sido) === st.region) && levelOk(r)).sort((a, b) => chrSchoolFirst(chr, a.s, b.s) || collator.compare(a.s.name, b.s.name));
    const items = list.map(r => `<li><a class="job" href="#/school/${r.s.idx}"><span class="name">${esc(r.s.name)}</span><span class="sub">${esc([sidoOf(r.s.sido), [r.under ? "대학" : "", r.grad ? "대학원" : ""].filter(Boolean).join("·")].filter(Boolean).join(" · "))}</span></a>${chrSchoolTags(chr, r.s)}${chrVision(chr.get(r.s.code))}</li>`);
    /* 직업 순서: 원자료에서 이 학과와 이어진 횟수가 많은 직업(=학과의 대표 직업) 먼저. 1,000개 넘는 학과와 이어진 범용 직업(공무원·연구원)은 뒤로.
       기독교 학과(신학·선교 등)는 사역 직업을 맨 위에 두고, 일반 학과는 사역 직업을 첫머리 대신 아래 '사역·선교로 이어지는 길' 줄로 따로 보여 준다. */
    const chrMajor = CHR_MAJOR.test(m.name);
    const linkN = j => ((pa.jobMajors.get(j.id) || []).find(x => x[0] === mid) || [])[1] || 0;
    const broad = j => Number(j.majorCount >= 1000);
    const byLink = (a, b) => broad(a) - broad(b) || linkN(b) - linkN(a) || a.majorCount - b.majorCount || collator.compare(a.name, b.name);
    const mjAll = [...pa.jobMajors].filter(([, ms]) => ms.some(x => x[0] === mid)).map(([jid]) => sc.byId.get(jid)).filter(Boolean);
    const mj = mjAll.filter(j => chrMajor || !isChrJob(j)).sort((a, b) => (chrMajor ? chrJobFirst(a, b) : 0) || byLink(a, b));
    const mjChr = chrMajor ? [] : mjAll.filter(isChrJob).sort(byLink);
    const rep = mj.length ? mj : mjChr;
    const jobsHtml = `<h2>이 학과와 이어지는 직업 <span class="count">${mjAll.length}개</span></h2>${mjAll.length ? `${mj.length ? `<ul class="majors">${limit("mj", mj).map(jobItem).join("")}</ul>${moreBtn("mj", mj.length)}` : ""}${mjChr.length ? `<h3 data-block="major-chr-jobs"><span class="tag chr">✝ 사역·선교로 이어지는 길</span> <span class="count">${mjChr.length}개</span></h3><p class="side">이 학과에서 배운 것으로 교회와 이웃을 섬기는 사역·선교 직업으로도 이어질 수 있어요.</p><ul class="majors">${limit("mjc", mjChr).map(jobItem).join("")}</ul>${moreBtn("mjc", mjChr.length)}` : ""}` : `<p class="side" data-nodata="jobs">이어지는 직업을 아직 정리하지 못했어요. <a class="tap" href="#/search/major">다른 학과 찾아보기</a></p>`}`;
    const descText = majorOverviewText(m.name, subj ? subj[1] : "", rep);
    const leadHtml = `<p class="lead" data-major-lead>${subj && subj[1] ? `${esc(subj[1])} 계열 학과예요. ` : ""}${rows.size ? `전국 ${rows.size}곳 학교에서 배울 수 있어요.` : ""}${rep.length ? ` ${esc(rep.slice(0, 3).map(x => x.name).join(" · "))}${rep.length > 3 ? " 같은" : ""} 직업과 이어져요.` : ""}</p>`;
    const repLine = rep.length ? `<p class="side" style="margin-top:6px;"><strong>대표 진출 분야:</strong> ${esc(rep.slice(0, 5).map(x => x.name).join(" · "))}${rep.length > 5 ? " 등" : ""}</p>` : "";
    const summaryCardHtml = official ? `${official}${repLine ? `<section class="refbox" data-block="major-summary" style="margin-bottom:20px;">${repLine}</section>` : ""}` : `<section class="refbox" data-block="major-summary" style="margin-bottom:20px;">
      <h2>학과 분야 안내</h2>
      <p class="side" data-major-desc-note>학과 이름과 계열로 만든 일반 안내예요. 학교나 학과가 직접 쓴 공식 소개가 아니에요.</p>
      <p style="font-size:15px;line-height:1.75;color:#1e293b;margin:8px 0 12px;">${descText}</p>
      ${rep.length ? `<p class="side" style="margin-top:6px;"><strong>대표 진출 분야:</strong> ${esc(rep.slice(0, 5).map(x => x.name).join(" · "))}${rep.length > 5 ? " 등" : ""}</p>` : ""}
    </section>`;
    const html = `${crumbs([["처음", "#/"], ...(job ? [[job.name, "#/job/" + job.id]] : originCrumb()), [m.name]])}<h1 tabindex="-1">${esc(m.name)}</h1>
      ${leadHtml}
      ${summaryCardHtml}
      ${jobsHtml}
      ${subjectsHtml(subj)}
      <div class="filters"><label>지역 <select id="f-region"><option value="">전체</option>${regions.map(r => `<option ${r === st.region ? "selected" : ""}>${esc(r)}</option>`).join("")}</select></label>
      <label>과정 <select id="f-level"><option value="">전체</option><option value="under" ${st.level === "under" ? "selected" : ""}>대학</option><option value="grad" ${st.level === "grad" ? "selected" : ""}>대학원</option></select></label></div>
      <h2>학교 <span class="count">${list.length}곳</span></h2>${items.length ? `<ul class="jobs">${items.slice(0, st.shown["schools"] || PAGE).join("")}</ul>${moreBtn("schools", items.length)}` : `<p class="notice">조건에 맞는 학교가 없어요.</p>`}
      ${evidence("학교와 학과 정보는 공공기관이 공개한 자료를 모아 정리했어요. 최신 내용은 대학 정보 사이트에서 학교 이름으로 찾아 확인할 수 있어요.", "https://academyinfo.go.kr", "대학 정보 사이트 열기")}${st.origin === "search" ? again() : ""}`;
    return { title: m.name, html };
  }

    async function univLoc(s) {                                             // 대학·전문대 위치: 시·군·구가 적힌 곳 → 시·군·구, 주소 문구만 있는 곳 → 시·도, 둘 다 없으면 위치 자료 없음(시·도 이름만 있는 곳은 주소가 아니라서 버튼 없음)
    try {
      const U = await file("univ_sigungu.json");
      if (U.items[s.code]) return { sido: sidoOf(s.sido), sg: U.items[s.code] };
      if (U.addr_sido[s.code]) return { sido: U.addr_sido[s.code], sg: "" };
    } catch (e) { /* 자료를 못 읽으면 위치 칸은 '위치 자료가 아직 없어요' */ }
    return { sido: "", sg: "" };
  }
  async function viewSchool(idx) {
    const pa = await loadPaths();
    const s = pa.schools.get(Number(idx));
    if (!s) return viewNotFound();
    const majors = [...(pa.schoolMajors.get(s.idx) || [])].map(id => pa.majorById.get(id)).filter(Boolean).sort((a, b) => collator.compare(a.name, b.name));
    const sc = await loadScope();
    const jc = new Map();                                       // 직업 id → 이 학교의 학과와 이어진 학과 수
    for (const m of majors) for (const jid of pa.majorJobs.get(m.id) || []) jc.set(jid, (jc.get(jid) || 0) + 1);
    const jl = [...jc].map(([jid, n]) => ({ j: sc.byId.get(jid), n })).filter(r => r.j).sort((a, b) => chrJobFirst(a.j, b.j) || b.n - a.n || collator.compare(a.j.name, b.j.name));
    const [chr, rank, pend, ud] = await Promise.all([loadChristian(), loadRank(), loadChrPend(), loadUnivDetails()]);
    const us = await univLoc(s);
    const det = ud[s.code] || {};                               // 본교 누리집 대체는 자료(univ_details)에서 이미 채웠다
    const ch = chrEv(chr, s.code, s.name, s.chr);
    const kind = univKind(s.type, s.name);
    const intro = `${josa(s.name, "은", "는")} ${s.sido ? s.sido + "에 있는 " : ""}${{ dept: "대학의 특수교육 관련 학과", college: "전문대학", unsure: "대학 계열 기관", univ: "대학" }[kind]}${ie({ dept: "학과", college: "전문대학", unsure: "기관", univ: "대학" }[kind])}.${ch && !isListOnly(ch) ? (ch === chr.get(s.code) ? (ch.basis_parent ? ` ✝ 모기관인 ${josa(ch.basis_parent, "은", "는")} ${faithWord(ch)} 신앙을 바탕으로 한 곳이에요.` : " ✝ 기독교 신앙을 바탕으로 학생들을 세우는 학교예요.") : ` ✝ 본교인 ${josa(ch.name, "은", "는")} 기독교 신앙을 바탕으로 학생들을 세우는 대학이에요.`) : ""}${jl.length ? ` 이 학교의 학과를 거쳐 ${[...jl].sort((a, b) => b.n - a.n || collator.compare(a.j.name, b.j.name)).slice(0, 3).map(r => r.j.name).join("·")}${jl.length > 3 ? " 같은" : ""} 직업으로 이어지는 길을 볼 수 있어요.` : ""}${kind === "unsure" ? " 정확한 학교 종류(전문대학·대학원 등)는 확인 중이에요." : ""}${det.desc ? ` ${det.desc}` : majors.length ? ` 이 학교에서 찾을 수 있는 학과는 ${majors.length}개예요.` : ""}`;
    const chrPend = !ch && pend.some(p => p.code === s.code) ? `<p class="side" data-chr="pending">기독교 학교인지 확인 중이에요. 확인되기 전에는 기독교 학교로 표시하지 않아요.</p>` : "";
    const majorsHtml = majors.length ? `<p class="side">개설 학과 <b>${majors.length}개</b></p><ul class="majors">${majors.slice(0, st.shown["sm"] || PAGE).map(m => `<li><a class="job" href="#/major/${esc(m.id)}"><span class="name">${esc(m.name)}</span></a></li>`).join("")}</ul>${moreBtn("sm", majors.length)}` : `<p class="side" data-nodata="majors">이 학교의 전체 학과는 <a href="https://www.academyinfo.go.kr" target="_blank" rel="noopener noreferrer">대학알리미 ↗<span class="sr-only"> (새 창으로 열려요)</span></a>에서 볼 수 있어요.</p>`;
    const card = schoolCard({ eyebrow: UNIV_SUB[kind], name: s.name, region: s.sido || String(det.addr || "").split(/\s+/).slice(0, 2).join(" "), est: det.est || "", addr: det.addr || "", office: "", phone: det.phone || "", home: homeUrl(det.home), intro, chr: ch ? chrBlock(ch, "univ", ch !== chr.get(s.code), kind === "dept" ? "학과·대학원" : "학교") : chrPend || (s.chr ? chrFlagBlock("univ") : ""), christian: ch, chrParent: !!ch && ch !== chr.get(s.code), univ: true, bridge: "", majors: majorsHtml,
      loc: { id: s.code, addr: det.addr || "", sido: us.sido, sg: us.sg, p: null } });
    const html = `${crumbs([["처음", "#/"], ...originCrumb(), [s.name]])}${card}
      ${jl.length ? `<h2>이 학교의 학과와 이어지는 직업 <span class="count">${jl.length}개</span></h2><p class="side">이 학교의 학과를 배우고 나서 걸을 수 있는 길이에요. 눌러서 어떤 일을 하는지 살펴보세요.</p><ul class="majors">${limit("sj", jl).map(r => jobItem(r.j)).join("")}</ul>${moreBtn("sj", jl.length)}` : `<h2>이 학교의 학과와 이어지는 직업</h2><p class="side" data-nodata="jobs">이어지는 직업은 <a href="#/search/job">직업 이름으로 찾아보기</a>에서 학과별로 살펴볼 수 있어요.</p>`}
      ${rankBlock(rank, s.code)}
      ${await rankRefHtml()}
      ${evidence("학교 정보는 공공기관이 공개한 자료를 모아 정리했어요. 소속과 신앙 내용은 학교에 직접 확인하세요.", "https://academyinfo.go.kr", "대학 정보 사이트 열기")}${st.origin === "search" ? again() : ""}`;
    return { title: s.name, html };
  }

  /* ---------- 입구 3: 특수학급·특수학교 찾기 ---------- */
  const spKind = tab => tab === "class" ? "klass" : "school";
  function spFiltered(list, tab, ignoreSido) {                          // ignoreSido: 지도에 시도별 수를 그릴 때(시도·시군구 조건만 빼고 센다)
    const f = st.sp, q = tidy(f.q).replace(/\s/g, "").toLowerCase();
    return list.filter(r => (ignoreSido || !f.sido || r.sido === f.sido) && (ignoreSido || !f.sg || (f.sg === "-" ? !r.sg : r.sg === f.sg)) && (!f.est || r.est === f.est)
      && (tab !== "class" || !f.level || r.level === f.level) && (!q || r.key.includes(q))
      && (tab === "class" || !f.dis.length || f.dis.some(d => d === NONE ? !r.dis : !!(r.dis && r.dis.includes(d)))) && (tab === "class" || !f.stg.length || f.stg.some(d => d === NONE ? !r.stage : !!(r.stage && r.stage.includes(d)))));
  }
  function spSelect(id, label, options, value, allLabel) {
    return `<label>${esc(label)} <select id="${id}"><option value="">${esc(allLabel)}</option>${options.map(o => `<option value="${esc(o[0])}" ${o[0] === value ? "selected" : ""}>${esc(o[1])}</option>`).join("")}</select></label>`;
  }
  function spSgSelect(list) {                                           // 시·군·구는 시도를 고른 뒤에만 나온다. 시·군·구로 나눌 수 없는 시도(세종)는 나오지 않는다.
    if (!st.sp.sido) return "";
    const inSido = list.filter(r => r.sido === st.sp.sido);
    const names = [...new Set(inSido.map(r => r.sg).filter(Boolean))].sort(collator.compare);
    if (!names.length) return "";
    const opts = names.map(n => [n, n]);
    if (inSido.some(r => !r.sg)) opts.push(["-", "그 밖의 곳"]);
    return spSelect("sp-sg", "시·군·구", opts, st.sp.sg, "전체");
  }
  function spCard(r, tab) {
    const dl = [["주소", r.address], ["관할 교육청", r.office], ["전화", r.phone]].filter(f => f[1])
      .map(f => `<dt>${f[0]}</dt><dd>${f[0] === "전화" && telHref(r.phone) ? `<a class="tel" href="${telHref(r.phone)}">${esc(r.phone)}</a>` : esc(f[1])}</dd>`);
    dl.push(`<dt>홈페이지</dt><dd>${r.home ? `<a href="${esc(r.home)}" target="_blank" rel="noopener noreferrer">학교 홈페이지 열기 ↗<span class="sr-only"> (새 창으로 열려요)</span></a>` : `<a href="https://www.schoolinfo.go.kr" target="_blank" rel="noopener noreferrer">학교알리미에서 홈페이지 찾기 ↗<span class="sr-only"> (새 창으로 열려요)</span></a>`}</dd>`);
    if (r.classes != null) {
      if (tab === "class") {
        const clsTxt = `${r.classes}개${r.totalClasses != null ? ` (전체 ${r.totalClasses}학급)` : ""}`;
        const stuTxt = `${r.students}명${r.totalStudents != null ? ` (전체 ${r.totalStudents.toLocaleString("ko-KR")}명)` : ""}`;
        dl.push(`<dt>특수학급 수</dt><dd>${clsTxt}</dd>`, `<dt>특수학급 학생 수</dt><dd>${stuTxt}</dd>`);
      } else {
        dl.push(`<dt>학급 수</dt><dd>${r.classes}개</dd>`, `<dt>학생 수</dt><dd>${r.students}명</dd>`);
      }
    }
    if (tab !== "class") {
      dl.push(`<dt>교육 대상 장애</dt><dd data-block="special-dis">${r.dis ? r.dis.map(x => `<span class="tag">${esc(x)}</span>`).join(" ") : `<span class="side">학교 공식 홈페이지에서 확인하지 못했어요 (모든 장애를 받는다는 뜻이 아니에요)</span>`}</dd>`);
      dl.push(`<dt>설치 과정</dt><dd data-block="special-stage">${r.stage ? r.stage.map(x => `<span class="tag">${esc(x)}</span>`).join(" ") : `<span class="side">학교 공식 홈페이지에서 확인하지 못했어요</span>`}</dd>`);
    } else dl.push(`<dt>받는 장애 영역</dt><dd data-block="special-dis"><span class="side">공식 자료에서 확인하지 못했어요. 특수학급이 있다고 해서 모든 장애를 받는다는 뜻은 아니니 학교에 문의하세요.</span></dd>`);
    const tags = (r.ev && !isListOnly(r.ev) ? chrBadge(r.ev) : "") + [r.est, tab === "class" ? r.level : ""].filter(Boolean).map(t => `<span class="tag">${esc(t)}</span>`).join("");
    return `<li class="sch"${r.ev && !isListOnly(r.ev) ? ` data-faith="${esc(faithOf(r.ev))}"${isProt(r.ev) ? ` data-chr="1"` : ""}` : ""}><h3>${esc(r.name)}</h3><p class="tags">${tags}</p><dl class="facts">${dl.join("")}</dl>${r.ev && !isListOnly(r.ev) ? `<p class="side chr-line">✝ ${faithWord(r.ev)} 학교로 확인한 근거 문구는 학교 상세에서 볼 수 있어요.</p>` : ""}</li>`;
  }
  function spResults(sp, tab) {
    const list = spFiltered(sp[spKind(tab)], tab).sort((a, b) => (isProt(b.ev) ? 1 : 0) - (isProt(a.ev) ? 1 : 0) || collator.compare(a.name, b.name));
    const n = list.length, shown = Math.min(st.sp.shown, n);
    const body = n ? `<ul class="schools">${list.slice(0, shown).map(r => spCard(r, tab)).join("")}</ul>${shown < n ? `<p><button type="button" class="btn ghost" data-spmore="1">더 보기</button></p>` : ""}`
      : `<p class="notice">조건에 맞는 학교가 없어요. 조건을 바꿔 보세요.</p>`;
    return `<h2 id="sp-count" aria-live="polite">찾은 학교 <span class="count">${n.toLocaleString("ko-KR")}곳</span></h2>${body}`;
  }
  function spProfFilters(sp) {                                          // 장애·과정 필터: 칸 안에서는 하나라도 맞으면(또는), 칸끼리는 모두 맞아야(그리고) 보여 준다. 정보 없음 = 공식 누리집에서 확인하지 못한 학교
    const f = st.sp, cnt = (key, v) => sp.school.filter(r => v === NONE ? !r[key] : !!(r[key] && r[key].includes(v))).length;
    const types = ["시각장애", "청각장애", "지체장애", "지적장애", "자폐성장애", "정서·행동장애", "의사소통장애", "건강장애", "발달장애", "발달지체", "중도·중복장애"].filter(x => cnt("dis", x) > 0);
    const stages = ["영아", "유치원", "초등학교", "중학교", "고등학교", "전공과"].filter(x => cnt("stage", x) > 0);
    const box = (kind, key, opts, sel, legend) => `<fieldset class="chkgrp" id="sp-${kind}"><legend>${legend}</legend>${opts.map(o => `<label class="chk"><input type="checkbox" data-sp${kind}="${esc(o)}" ${sel.includes(o) ? "checked" : ""}> ${esc(o)} <span class="count">${cnt(key, o)}</span></label>`).join("")}<label class="chk"><input type="checkbox" data-sp${kind}="${NONE}" ${sel.includes(NONE) ? "checked" : ""}> ${DIS_NONE_LABEL} <span class="count">${cnt(key, NONE)}</span></label></fieldset>`;
    return `<div class="filters" id="sp-prof-filters">${box("dis", "dis", types, f.dis, "교육 대상 장애")}${box("stg", "stage", stages, f.stg, "설치 과정")}<button type="button" class="btn ghost" id="sp-reset">조건 모두 지우기</button></div>
      <p class="side">장애 영역과 과정은 각 학교 공식 홈페이지에서 읽은 값이에요. 한 칸에서 여러 개를 고르면 하나라도 맞는 학교를, 두 칸을 함께 고르면 둘 다 맞는 학교를 보여 줘요. '정보 없음'은 학교가 모든 장애를 받는다는 뜻이 아니라 확인하지 못했다는 뜻이에요.</p>`;
  }
  async function viewSpecial(tab) {
    const sp = await loadSpecial();
    const f = st.sp, all = sp[spKind(tab)];
    if (f.sido && !all.some(r => r.sido === f.sido)) { f.sido = ""; f.sg = ""; }
    if (f.sg && !all.some(r => r.sido === f.sido && (f.sg === "-" ? !r.sg : r.sg === f.sg))) f.sg = "";
    const sidos = SIDO_ORDER.filter(s => all.some(r => r.sido === s)).map(s => [s, s]);
    const ests = ["공립", "사립", "국립"].filter(e => all.some(r => r.est === e)).map(e => [e, e]);
    const lv = [...LEVELS, OTHER_LEVEL].filter(l => sp.klass.some(r => r.level === l)).map(l => [l, l]);
    const tabLink = (t, name, n) => `<a class="tabbtn" href="#/special/${t}" ${t === tab ? 'aria-current="page"' : ""}>${esc(name)}<span>${n.toLocaleString("ko-KR")}곳</span></a>`;
    const html = `${crumbs([["처음", "#/"], ["특수학급·특수학교 찾기"]])}
      <h1 tabindex="-1">특수학급·특수학교 찾기</h1>
      <p class="lead">우리 지역의 특수학교와, 일반학교 안에 특수학급이 있는 학교를 찾아요.</p>
      <nav class="tabs" aria-label="학교 종류">${tabLink("school", "특수학교 (별도 학교)", sp.school.length)}${tabLink("class", "일반학교 안 특수학급", sp.klass.length)}</nav>
      <div class="filters" id="sp-filters">
        <label>학교 이름 <input type="search" id="sp-q" value="${esc(f.q)}" autocomplete="off" maxlength="30"></label>
        ${spSelect("sp-sido", "지역", sidos, f.sido, "전체")}<span id="sp-sg-wrap">${spSgSelect(all)}</span>
        ${tab === "class" ? spSelect("sp-level", "학교급", lv, f.level, "전체") : ""}
        ${spSelect("sp-est", "설립", ests, f.est, "전체")}
      </div>
      ${tab === "school" ? spProfFilters(sp) : `<p class="side">일반학교 안 특수학급이 받는 장애 영역은 공식 자료에서 확인하지 못했어요. 학교에 문의하세요.</p>`}
      <div id="sp-results">${spResults(sp, tab)}</div>`;
    return { title: "특수학급·특수학교 찾기", html };
  }
  async function spRefresh(sgToo) {
    try { await spRefresh2(sgToo); } catch (e) { const box = document.getElementById("sp-results"); if (box) box.innerHTML = `<p class="notice" data-error="special">자료를 불러오지 못했어요. 인터넷이 느리거나 자료가 잠시 열리지 않아요.</p><p><button type="button" class="btn" id="sp-retry">다시 시도</button> <a class="tap" href="#/search">다른 항목 찾아보기</a></p>`; }
  }
  async function spRefresh2(sgToo) {                                      // 조건이 바뀌면 결과만 다시 그린다(입력 중인 칸의 커서는 그대로)
    const tab = location.hash.split("/")[2] === "class" ? "class" : "school";
    const sp = await loadSpecial();
    if (sgToo) document.getElementById("sp-sg-wrap").innerHTML = spSgSelect(sp[spKind(tab)]);
    document.getElementById("sp-results").innerHTML = spResults(sp, tab);   // 결과는 바로, 한 번만 그린다
  }

  /* ---------- 입구 2: 직접 검색하기 ---------- */
  const S_TABS = [["job", "직업"], ["major", "학과"], ["school", "학교"], ["org", "기관"]];
  const S_EXAMPLES = { job: ["사회복지사", "상담", "교사"], major: ["유아교육", "신학", "컴퓨터"], school: ["서울", "한빛", "신학"], org: ["용인", "도서관", "상담"] };
  const S_ASK = { job: "직업 이름", major: "학과 이름", school: "학교 이름", org: "기관 이름이나 지역" };
  const MAJOR_CATS = [["교육·사범", /교육|사범|교직|유아|보육/], ["사회·복지", /복지|상담|사회|심리|청소년|행정|법/], ["의료·보건", /간호|의|보건|치|약|재활|임상|건강|작업치료|물리치료/],
    ["공학·IT", /공학|컴퓨터|소프트|정보|전자|전기|기계|AI|인공지능|데이터|건축|IT/], ["인문·신학", /신학|철학|종교|기독|목회|선교|문학|국어|역사|어문|영어|인문/], ["예술·체육", /음악|미술|디자인|예술|체육|무용|영상|공연|실용/], ["경영·경제", /경영|경제|회계|무역|관광|호텔|유통|금융/]];
  const S_CATS = { job: ["돌봄·의료·보건", "사회·복지", "교육·직업훈련", "AI·기술", "예술·문화", "경영·창업", "온라인·콘텐츠", "공공·공익", "국제·해외"],     // 9대 직업 분야(자료의 분야 이름 그대로)
    major: MAJOR_CATS.map(c => c[0]), school: ["특수학교", "일반 고등학교", "특수학급 설치교", "대학교", "전문대학", "특수교육 학과", "시각장애", "청각장애", "지체장애", "지적장애", "자폐성장애", "정서·행동장애", "의사소통장애", "발달장애", "영아 과정", "유치원 과정", "초등학교 과정", "중학교 과정", "고등학교 과정", "전공과 과정"], org: ["직업훈련 기관", "평생교육 기관"] };
  const nk = v => String(v == null ? "" : v).normalize("NFC").toLowerCase().replace(/[\s·ㆍ.,()\[\]\-_\/]/g, "");   // 띄어쓰기·가운뎃점·괄호 같은 기호를 무시
  const byName = (a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0);                                      // 한글 음절은 코드 순서가 가나다순
  const ORG_KIND = { lifelong_edu: "평생교육 기관", training_institution: "직업훈련 기관", special_ed_dept: "대학의 특수교육 학과" };
  const K12_STATE = { "휴(원)교": "쉬고 있는 학교", "폐(원)교": "문을 닫은 학교" };
  const loadK12Row = id => once("k12row:" + id, async () => {          // 학교 상세용: 그 학교가 든 샤드 1개만 읽는다(전체 28샤드 5MB 를 받으면 느린 인터넷에서 20초가 넘는다). 검색 색인은 8칸뿐이라 상세에 쓰지 않는다
    const sh = D["manifest.json"].shards.schools_k12.find(e => id >= e.first_key && id <= e.last_key);
    if (!sh) return null;
    const doc = await file(sh.file);
    return doc.rows.find(x => x[0] === id) || null;
  });
  const loadSchoolStat = id => once("stat:" + id, async () => {        // 학교 규모(학생수·학급수·학년별): 학교 id 단위 작은 샤드(약 37KB) 1개. 못 읽거나 자료가 없으면 null → 카드는 점선 칸을 유지한다
    try {
      const m = D["manifest.json"].shards.school_stats;
      const sh = m && m.find(e => id >= e.first_key && id <= e.last_key);
      if (!sh) return null;
      const doc = await file(sh.file);
      const r = doc.rows.find(x => x[0] === id);
      return r ? { classes: r[1], students: r[2], grades: r[3] } : null;
    } catch (e) { return null; }
  });
  const loadOfficeMap = () => once("officemap", async () => {            // 시·도 → 관할 교육청 이름(특수학교 자료 41KB에서). 못 읽으면 빈 표 → 칸은 '아직 확인하지 못했어요'
    try { const m = new Map(); for (const r of (await file("schools_special.json")).rows) if (r[7] && !m.has(sidoOf(r[3]))) m.set(sidoOf(r[3]), tidy(r[7])); return m; } catch (e) { return new Map(); }
  });
  const loadSpecialRow = id => once("spone:" + id, async () => {         // 별도 특수학교 상세용: 목록 파일(41KB)에서 그 학교 한 줄 + 연결된 일반학교 표 한 줄만
    const [spDoc, pub, profDoc] = await Promise.all([file("schools_special.json"), loadChrPublic().catch(() => new Map()), loadSpecialProfile()]);
    const r = spDoc.rows.find(x => x[0] === id);
    if (!r) return null;
    const [k, stat] = r[10] ? await Promise.all([loadK12Row(r[10]), loadSchoolStat(r[10])]) : [null, null];
    return { stat, id: r[0], name: r[2], sido: sidoOf(r[3]), sg: sgOf(r[4], r[5]), est: r[6], educationOffice: tidy(r[7]), address: tidy(r[8]), level: "특수학교", kessId: r[10],
      chr: r[11] === true, ev: pub.get(r[0]) || (r[10] && pub.get(r[10])) || null, kid: k ? k[0] : "", phone: tidy(r[12]), home: homeUrl(r[13]), disabilityTypes: Array.isArray(r[14]) ? r[14] : [], prof: profDoc.items[r[0]] || null, classes: k ? k[13] : null, students: k ? k[14] : null };
  });
  const loadK12 = () => once("k12", async () => { const rows = await dictRows("schools_k12_index", (x, p) => ["k12-" + x[0], x[1], p(0, x[2]), p(1, x[3]), null, p(2, x[4]), p(3, x[5]), p(4, x[6]), null, p(5, x[7])]); return { rows, byId: new Map(rows.map(r => [r[0], r])) }; });   // 검색용 색인(8칸만): 상세에는 쓰지 않는다 — 학교 상세는 loadK12Row 가 원래 샤드 1개를 읽는다
  const loadOrgs = () => once("orgs", async () => { const o = await shards("orgs_training"); return { rows: o, byId: new Map(o.map(r => [r[0], r])) }; });
  const profCats = pf => pf ? [...(pf.dis || []), ...(pf.stage || []).map(x => x + " 과정")] : [];
  const profSub = pf => pf ? [pf.dis && pf.dis.length ? "장애 " + pf.dis.join("·") : "", pf.stage && pf.stage.length ? "과정 " + pf.stage.join("·") : ""] : [];
  const searchIndex = {
    job: () => once("ix-job", async () => { const jobs = (await loadScope()).jobs, no = new Map([...jobs].map(j => j.id).sort().map((id, i) => [id, i + 1]));   // 카드 번호 = 직업 id 순서(직업카드_모음의 ○○○호와 같다)
      return jobs.map(j => ({ name: j.name, keys: [nk(j.name)], href: "#/job/" + j.id, cats: [j.field], field: j.field, no: no.get(j.id), art: pokeArtSrc(j), own: pokeOwnArt(j), fb: pokeFallbackSrc(j), sub: j.linked ? `학과 ${j.majorCount}개` : "" })).sort(byName); }),
    major: () => once("ix-major", async () => (await shards("majors")).map(r => ({ name: r[1], keys: r[3].map(nk), href: "#/major/" + r[0], cats: MAJOR_CATS.filter(c => c[1].test(r[1])).map(c => c[0]), sub: "" })).sort(byName)),
    school: () => once("ix-school", async () => {
      const [univ, k, spc, profDoc, spd0] = await Promise.all([shards("schools_univ", BULK_TIMEOUT_MS), loadK12(), k12SpecialRows(), loadSpecialProfile(), file("schools_special.json").catch(() => ({ rows: [] }))]);
      const profByKess = new Map(spd0.rows.filter(x => x[10] && profDoc.items[x[0]]).map(x => [x[10], profDoc.items[x[0]]]));
      const hasClass = new Set(spc.filter(r => r[13] > 0 && r[2] !== "특수학교").map(r => r[0]));
      const a = univ.map(r => ({ name: r[2], keys: [nk(r[2])], href: "#/school/" + r[0], cats: [{ dept: "특수교육 학과", college: "전문대학" }[univKind(r[3], r[2])] || "대학교"], sido: r[4], sub: [r[4], UNIV_SUB[univKind(r[3], r[2])]].filter(Boolean).join(" · ") }));
      const b = k.rows.map(r => ({ name: r[1], keys: [nk(r[1])], href: "#/k12/" + r[0], id: r[0], cats: [r[2] === "특수학교" ? "특수학교" : r[2] === "고등학교" ? "일반 고등학교" : "", hasClass.has(r[0]) ? "특수학급 설치교" : "", ...profCats(profByKess.get(r[0]))].filter(Boolean), sido: r[3], sg: sgOf(r[5], r[6]), sub: [r[3], r[2], r[7], K12_STATE[r[9]] || "", ...profSub(profByKess.get(r[0]))].filter(Boolean).join(" · ") }));
      const c = spd0.rows.filter(r => !r[10]).map(r => { const pf = profDoc.items[r[0]]; return { name: r[2], keys: [nk(r[2])], href: "#/sschool/" + r[0], id: r[0], cats: ["특수학교", ...profCats(pf)], sido: sidoOf(r[3]), sg: sgOf(r[4], r[5]), sub: [sidoOf(r[3]), "특수학교", r[6], ...profSub(pf)].filter(Boolean).join(" · ") }; });   // 학교 식별번호(KESS)가 없어 학교 표에 연결되지 않은 특수학교 3곳도 찾는다(칩 199 → 202)
      return a.concat(b, c).sort(byName);
    }),
    org: () => once("ix-org", async () => {
      const o = await loadOrgs();
      const b = o.rows.map(r => ({ name: r[1], keys: [nk(r[1] + " " + (r[3] || ""))], href: "#/org/" + r[0], cats: [r[2] === "training_institution" ? "직업훈련 기관" : "평생교육 기관"], sido: String(r[3] || "").split("·")[0], sg: validSg(r[4]), sub: [ORG_KIND[r[2]], r[3]].filter(Boolean).join(" · ") }));
      return b.sort(byName);   // 대학의 특수교육 학과 102건은 학과·학교 쪽(학교 탭 '특수교육 학과' 칩)으로 옮겼다
    })
  };
  let sTok = 0;
  const sGuide = tab => `<p class="side">찾고 싶은 ${S_ASK[tab]}의 일부를 써 보세요. 띄어쓰기는 상관없어요.</p><p class="side">이런 말로 찾아볼 수 있어요.</p><div class="chips">${S_EXAMPLES[tab].map(x => `<button type="button" class="chip" data-ssex="${esc(x)}">${esc(x)}</button>`).join("")}</div>`;
  const sNone = tab => `<p class="notice">이런 이름은 찾지 못했어요.</p><p class="side">다른 말로 찾아보세요. 이름의 일부만 짧게 써 보거나, 띄어쓰기 없이 써 보세요. 다른 종류에서 찾아볼 수도 있어요.</p>
    <div class="chips">${S_TABS.filter(t => t[0] !== tab).map(t => `<a class="chip" href="#/search/${t[0]}">${t[1]}에서 찾기</a>`).join("")}</div>`;
  async function sRefresh() {
    const box = document.getElementById("ss-results");
    if (!box) return;
    const tok = ++sTok, tab = st.s.tab, q = nk(st.s.q), cat = st.s.cat;
    if (!q && !cat && tab !== "job") { box.dataset.state = "done"; box.dataset.n = ""; box.innerHTML = sGuide(tab); return; }   // 직업 탭은 처음부터 그림 카드 목록(칩·검색은 거르기)
    box.dataset.state = "loading";
    const slow = setTimeout(() => { if (tok === sTok && box.dataset.state === "loading") box.innerHTML = `<p class="side" role="status">자료를 불러오는 중이에요(느린 인터넷에서는 조금 걸려요). 잠시만 기다려 주세요.</p>`; }, 800);
    let list;
    try {
      const ix = await searchIndex[tab](); list = ix.filter(r => (!cat || r.cats.includes(cat)) && (!q || r.keys.some(k => k.includes(q))));
      clearTimeout(slow);
    }
    catch (e) { clearTimeout(slow); if (tok === sTok) { box.dataset.state = "done"; box.innerHTML = `<p class="notice" data-error="search">자료를 불러오지 못했어요. 인터넷이 느리거나 자료가 잠시 열리지 않아요.</p><p><button type="button" class="btn" id="search-retry">다시 시도</button> <a class="tap" href="#/search">다른 항목 찾아보기</a></p>`; } return; }
    if (tok !== sTok) return;
    let chrOf2 = () => false;                                            // 기독교 최상단 정렬(같은 무리 안의 순서는 이름순 그대로): 직업=사역 직업, 학과=신학·선교 계열, 학교·기관=허용 목록·분류 자료가 있는 대학
    if (tab === "job") chrOf2 = r => CHR_JOB.test(r.name);
    else if (tab === "major") chrOf2 = r => CHR_MAJOR.test(r.name);
    else if (tab === "school" || tab === "org") { try { const [pa2, chr2, o2, spd] = await Promise.all([loadPaths(), loadChristian(), loadOrgs(), file("schools_special.json").catch(() => ({ rows: [] }))]); if (tok !== sTok) return;   // 대학·초중고·기관 모두 상세와 같은 규칙(chrEv)
      const neisOf = new Map(spd.rows.filter(x => x[10]).map(x => [x[10], x[0]]));                // 초중고 표의 특수학교 → 특수학교 표 코드(근거가 그 코드로 올라온 경우)
      chrOf2 = r => { let m;
        if ((m = /^#\/school\/(\d+)$/.exec(r.href))) { const s2 = pa2.schools.get(Number(m[1])); return (s2 && chrEv(chr2, s2.code, s2.name, s2.chr)) || false; }
        if ((m = /^#\/k12\/(.+)$/.exec(r.href))) return chr2.get(m[1]) || chr2.get(neisOf.get(m[1])) || false;
        if ((m = /^#\/org\/(.+)$/.exec(r.href))) { const o = o2.byId.get(m[1]); return (o && chrEv(chr2, o[0], o[1], o[7] === true)) || false; }
        return false; }; } catch (e) { /* 기독교 자료를 못 읽으면 이름순 그대로 */ } }
    const prot = v => v === true || isProt(v); list = list.map(r => [r, chrOf2(r)]).sort((a, b) => Number(prot(b[1])) - Number(prot(a[1]))).map(x => (x[1] && !isListOnly(x[1]) ? Object.assign({}, x[0], { chr: prot(x[1]), faith: x[1] === true ? "개신교" : faithOf(x[1]) }) : x[0]));
    const n = list.length, shown = Math.min(st.s.shown, n);
    box.innerHTML = n ? `<h2 aria-live="polite">찾은 ${esc(S_TABS.find(t => t[0] === tab)[1])} <span class="count">${n.toLocaleString("ko-KR")}개</span></h2>
      ${tab === "job" && !q && !cat ? `<p class="side">그림을 훑어보다 마음에 드는 직업을 눌러 보세요. 위에서 분야를 고르거나 이름을 써서 좁힐 수 있어요.</p>` : ""}
      ${cat === "전문대학" ? `<p class="side">이름으로 전문대학이라고 확실히 알 수 있는 곳만 모았어요. 종류를 확인하고 있는 기관은 ‘대학교’ 칩에 함께 들어 있어요.</p>` : ""}
      ${tab === "job" ? `<ul class="job-grid">${list.slice(0, shown).map(jobCard).join("")}</ul>` : `<ul class="jobs">${list.slice(0, shown).map(r => `<li><a class="job" href="${esc(r.href)}"><span class="name">${esc(r.name)}</span>${r.sub ? `<span class="sub">${esc(r.sub)}</span>` : ""}</a>${r.chr ? `<span class="tag chr">${tab === "major" ? "✝ 이름에 신학·선교 등" : "✝ 기독교"}</span>` : r.faith ? `<span class="tag chr" data-faith="${esc(r.faith)}">✝ ${esc(FAITH_WORD[r.faith] || "")}${/^삼육/.test(r.faith) ? " · 제칠일안식일예수재림교" : ""}</span>` : ""}</li>`).join("")}</ul>`}${shown < n ? `<p><button type="button" class="btn ghost" data-ssmore="1">더 보기</button></p>` : ""}`
      : `<h2 aria-live="polite">찾은 ${esc(S_TABS.find(t => t[0] === tab)[1])} <span class="count">0개</span></h2>${sNone(tab)}`;
    box.dataset.n = String(n);
    box.dataset.state = "done";
  }
  function viewSearch(tab) {
    if (st.s.tab !== tab) { st.s.sido = ""; st.s.sg = ""; st.s.cat = ""; }
    st.s.tab = tab;
    const tabs = S_TABS.map(t => `<a class="tabbtn" href="#/search/${t[0]}" ${t[0] === tab ? 'aria-current="page"' : ""}>${t[1]}</a>`).join("");
    const html = `${crumbs([["처음", "#/"], ["직접 검색하기"]])}
      <h1 tabindex="-1">직접 검색하기</h1>
      <p class="lead">직업·학과·학교·기관을 이름으로 찾아요. 쓴 글자는 저장하거나 보내지 않아요.</p>
      <nav class="tabs four" aria-label="찾을 종류">${tabs}</nav>
      <div class="filters"><label>${esc(S_ASK[tab])} <input type="search" id="ss-q" value="${esc(st.s.q)}" autocomplete="off" maxlength="40"></label></div>
      <p class="side" id="ss-browse-label">이름을 몰라도 분야를 눌러 둘러볼 수 있어요.</p>
      <div class="chips" id="ss-cats" role="group" aria-labelledby="ss-browse-label">${S_CATS[tab].map(c => `<button type="button" class="chip${st.s.cat === c ? " active" : ""}" data-scat="${esc(c)}" aria-pressed="${st.s.cat === c}">${esc(c)}</button>`).join("")}</div>
      ${tab === "org" ? `<p class="side">직업훈련·평생교육 기관을 보여 드려요. 대학의 특수교육 학과는 ‘학교’ 탭의 ‘특수교육 학과’ 칩에서 찾을 수 있어요. 지금은 경기 용인 자료가 가장 많아요.</p>` : ""}
      <div id="ss-results" data-state="loading"></div>`;
    setTimeout(sRefresh, 0);
    return { title: "직접 검색하기", html };
  }
  async function viewJobs() {
    const { jobs } = await loadScope();
    const list = jobs.slice().sort(byName);
    const shown = Math.min(st.jobsShown, list.length);
    const html = `${crumbs([["처음", "#/"], ["직업 모두 보기"]])}
      <h1 tabindex="-1">직업 모두 보기</h1>
      <p class="lead">소명지도에 등록된 직업 ${list.length.toLocaleString("ko-KR")}개예요. 이름이나 분야를 눌러 직업 소개를 살펴보세요.</p>
      <p class="chips"><a class="chip" href="#/search/job">직업 이름으로 검색</a></p>
      <ul class="jobs">${list.slice(0, shown).map(jobItem).join("")}</ul>
      ${shown < list.length ? `<p><button type="button" class="btn ghost" id="jobs-more">더 보기 (${shown}/${list.length})</button></p>` : `<p class="side">직업 ${list.length.toLocaleString("ko-KR")}개를 모두 보여 드렸어요.</p>`}`;
    return { title: "직업 모두 보기", html };
  }
  /* ---------- 학교 카드(오너 확정 형식 · 일반학교·특수학교·특수학급 있는 일반학교 상세 · 대학·기관·직업·학과 화면은 이 형식을 쓰지 않는다) ---------- */
  const CARD_NONE = "아직 확인하지 못했어요";
  const cNone = () => `<span class="empty">${CARD_NONE}</span>`;
  function cardLoc(info) {                                                // 기존 지도 버튼 규칙(M1 점·M2 추정 점·좌표 없음/M3 시·군·구→시·도 대략 위치·자료 없음 안내)을 그대로 쓰고 모양만 카드 안으로
    const { id, addr, p } = info, sido = info.sido || "", sg = info.sg || "";
    if (!p && !addr && !sg && !sido) return { btn: "", extra: `<p class="side" data-loc="none">위치 자료가 아직 없어요.</p>` };
    const kind = p ? (p.m === 1 ? "point" : "estimate") : "approx";
    return { btn: `<button type="button" class="btn ghost" id="loc-open" aria-expanded="false" aria-controls="loc-panel" data-loc-id="${esc(id)}" data-loc-sido="${esc(sido)}" data-loc-sg="${esc(sg)}" data-loc-m="${p ? p.m : 0}">지도에서 보기</button>`,
      extra: `<section class="locbox" data-loc="${kind}">${p && p.m === 2 ? `<p class="side"><span class="tag" data-badge="estimate">위치 추정</span> 주소만 맞은 공개 위치 자료예요. 정확한 점이 아닐 수 있어요.</p>` : ""}${p ? "" : `<p class="side" data-loc-note="approx">${APPROX_NOTE} 정확한 위치 자료가 없어서 점은 찍지 않고 해당 지역만 칠해 보여 드려요.</p>`}<div id="loc-panel" hidden></div></section>` };
  }
  function schoolCard(c) {                                                // c: { eyebrow, name, region, notice, est, addr, phone, home, bridge(html), chr(html), pending(html), loc }
    const tel = telHref(c.phone), off = c.univ ? ["https://www.academyinfo.go.kr", "대학알리미"] : ["https://www.schoolinfo.go.kr", "학교알리미"];
    const offLink = what => c.org ? "" : `<a href="${off[0]}" target="_blank" rel="noopener noreferrer">${off[1]}에서 ${what} 찾기 ↗<span class="sr-only"> (새 창으로 열려요)</span></a>`;   // 자료에 없으면 막다른 길 대신 공식 조회처를 잇는다
    const facts = [["설립", c.est ? esc(c.est) : ""], ["주소", c.addr ? esc(c.addr) : offLink("주소")], ["관할 교육청", c.office ? esc(c.office) : ""],
      ["전화", c.phone ? (tel ? `<a class="tel" href="${tel}">${esc(c.phone)}</a>` : esc(c.phone)) : offLink("전화")],
      ["홈페이지", c.home ? `<a href="${esc(c.home)}" target="_blank" rel="noopener noreferrer">학교 홈페이지 열기 ↗<span class="sr-only"> (새 창으로 열려요)</span></a>` : offLink("홈페이지")]]
      .filter(f => f[1]).map(f => `<dt>${f[0]}</dt><dd>${f[1]}</dd>`).join("");
    const loc = cardLoc(c.loc);
    /* 5단 표준 레이아웃: ① 헤더 ② 학교 소개 ③ 기본 정보 ④ 개설 학과·교육과정 ⑤ 위치·지도 — 특수학교·초중고·대학 모두 같은 순서 */
    return `<article class="scard" data-card="school"><div class="stop" data-sec="header"><div class="eyebrow">${esc(c.eyebrow)}${c.christian ? ` ${chrBadge(c.christian, c.org, c.chrParent)}` : ""}</div><h1 class="stitle" tabindex="-1">${esc(c.name)}</h1>${c.region ? `<div class="ssub" data-region="1">${esc(c.region)}</div>` : ""}${heroFig("school", c.name)}</div>
      <div class="sbody">${c.notice || ""}<section class="ssec" data-sec="intro"><h3>학교 소개</h3>${c.intro ? introP(c.intro) : ""}${c.chr || ""}</section>
      <section class="ssec" data-sec="info"><h3>기본 정보</h3><dl class="facts">${facts}</dl></section>
      <section class="ssec" data-sec="curriculum"${c.bridge || c.majors || c.srcline ? "" : " hidden"}><h3>${c.org ? "운영 안내" : "개설 학과·교육과정"}</h3>${c.bridge ? `<div class="bridge">${c.bridge}</div>` : ""}${c.majors || ""}${c.srcline || ""}</section>
      ${c.scale || ""}${c.pending || ""}<section class="ssec" data-sec="location"><h3>위치·지도</h3><div class="sactions">${loc.btn}</div>${loc.extra}</section>
      <p class="side cardnote">학교 정보는 공공기관이 공개한 자료를 모아 정리했어요. 최신 내용은 학교 홈페이지에서 볼 수 있어요.</p></div></article>`;
  }
  const bRow = (label, val, attr) => `<div class="bridge-row"${attr || ""}><span>${label}</span>${val}</div>`;
  const STAT_SRC = "학생수·학급수: 교육부·한국교육개발원 교육통계서비스 학교별 주요 현황, 2026년 4월 1일 기준";
  const nko = n => Number(n).toLocaleString("ko-KR");
  const scaleHtml = (stat, hasSpecialClass) => `<section class="ssec" data-block="scale"><h3>학교 규모</h3><div class="bridge">${bRow("학생수", `<b>${nko(stat.students)}명</b>`)}${bRow("학급수", `<b>${nko(stat.classes)}학급</b>`)}${stat.grades ? bRow("학년별 학생수", `<span class="grades">${stat.grades.map((n, i) => `${i + 1}학년 ${nko(n)}명`).join(" · ")}</span>`) : ""}</div><p class="side cardnote" data-src="stats">${STAT_SRC}${hasSpecialClass ? " (특수학급 포함)" : ""}</p></section>`;
  const srcLine = `<p class="side cardnote" data-src="stats">${STAT_SRC}</p>`;
  const SCHOOL_STATS_LINK = `<section class="ssec" data-block="stats-link"><h3>학교 규모</h3><p class="side">학생수·학급수·교육과정은 공식 조회처에서 볼 수 있어요.</p><p class="side"><a class="tap" href="https://www.schoolinfo.go.kr" target="_blank" rel="noopener noreferrer">학교알리미에서 보기 ↗<span class="sr-only"> (새 창으로 열려요)</span></a></p></section>`;
  const PENDING_SPECIAL_INFO = "", PENDING_GENERAL = SCHOOL_STATS_LINK, PENDING_SPECIAL = SCHOOL_STATS_LINK;
  const PROF_BASIS = { "TBL": "학교 공개 학생 현황표" };
  function profRows(prof) {                                               // 특수학교 상세(특수학교 경로·초중고 경로 공통): 교육 대상 장애·설치 과정과 그 근거. 값이 없으면 '확인하지 못함'(모든 장애·과정이라는 뜻이 아님)
    const dis = prof && prof.dis && prof.dis.length ? prof.dis : null, stg = prof && prof.stage && prof.stage.length ? prof.stage : null;
    const tag = a => a.map(x => `<span class="tag">${esc(x)}</span>`).join(" ");
    const src = (label, basis, quote, url) => quote ? `<p class="side">${label}: ${esc(basis || "학교 홈페이지")} — “${esc(quote)}”${url ? ` <a class="tap" href="${esc(url)}" target="_blank" rel="noopener noreferrer">원문 열기 ↗<span class="sr-only"> (새 창으로 열려요)</span></a>` : ""}</p>` : "";
    return bRow("교육 대상 장애", dis ? `<b data-dis="1">${tag(dis)}</b>` : `<span class="side">학교 공식 홈페이지에서 확인하지 못했어요. 모든 장애를 받는다는 뜻이 아니니 학교에 문의하세요.${prof && prof.dis_legacy ? ` (이전 자료에는 ${esc(prof.dis_legacy.join("·"))}로 적혀 있지만 학교 원문으로는 확인하지 못했어요.)` : ""}</span>`, ` data-block="special-dis"`)
      + bRow("설치 과정", stg ? `<b data-stage="1">${tag(stg)}</b>` : `<span class="side">학교 공식 홈페이지에서 확인하지 못했어요.</span>`, ` data-block="special-stage"`);   // '장애·과정 근거 더 보기' 펼침은 오너 결정(2026-10-21)으로 삭제
  }
  async function viewSpecialSchool(id) {                                   // 별도 특수학교 202곳 상세(K12 표에 연결이 없는 학교도 열린다) — 확정 학교 카드
    const r = await loadSpecialRow(id);
    if (!r) return viewNotFound();
    const region = [r.sido, r.sg].filter(Boolean).join(" · ");
    const p = await loadSchoolPoint(r.id);
    const bridge = bRow("특수학급", `<b>특수학교</b>`) + profRows(r.prof) + (r.classes != null ? bRow("학급·학생", `<b>학급 ${r.classes}개 · 학생 ${r.students}명</b>`, ` data-block="special"`) : "")
      ;
    const card = schoolCard({ eyebrow: "특수학교", name: r.name, region, est: r.est, addr: r.address, office: r.educationOffice, phone: r.phone, home: r.home, bridge, christian: r.ev, chr: r.ev ? chrBlock(r.ev, "special") : r.chr ? chrFlagBlock("special") : "", intro: k12Intro(r.name, "특수학교", r.est, r.sido, r.sg, 0, ""), pending: r.stat ? PENDING_SPECIAL_INFO : PENDING_SPECIAL, srcline: r.stat ? srcLine : "",
      loc: { id: r.id, addr: r.address, sido: r.sido, sg: r.sg, p } });
    return { title: r.name, html: `${crumbs([["처음", "#/"], ["특수학급·특수학교 찾기", "#/special/school"], [r.name]])}${card}<p><a class="tap" href="#/special/school">특수학교 목록으로</a></p>` };
  }
  async function viewK12(id) {                                             // 일반학교(초·중·고)·특수학급이 있는 일반학교·K12 쪽 특수학교 상세 — 확정 학교 카드
    const [r, stat] = await Promise.all([loadK12Row(id), loadSchoolStat(id)]);
    if (!r) return viewNotFound();
    const special = r[2] === "특수학교";
    const [chrK, rankK, officeMap] = await Promise.all([loadChristian(), loadRank(), loadOfficeMap()]);
    const spRow = special ? ((await file("schools_special.json").catch(() => null)) || { rows: [] }).rows.find(x => x[10] === r[0]) : null;   // 특수학교는 특수학교 표의 기독교 표시·코드도 함께 본다(특수학교 상세와 같은 판정)
    const chr = chrK.get(r[0]) || (spRow && chrK.get(spRow[0])) || null, chrFlag = r[15] === true || !!(spRow && spRow[11] === true);
    const lv = [validSg(r[5]), validSg(r[6])].filter((x, i, a) => x && a.indexOf(x) === i), region = [r[3], ...(lv.length ? lv : [validSg(r[4])])].filter(Boolean).join(" · ");   // 초안: 경기 · 수원시 · 영통구(시·군 r[5], 구 r[6]; 둘 다 없으면 KESS 구 r[4])
    const klass = r[13] > 0 ? bRow(special ? "학급·학생" : "특수학급", `<b>${special ? `학급 ${r[13]}개 · 학생 ${r[14]}명` : `${r[13]}학급 · 학생 ${r[14]}명`}</b>`, ` data-block="special"`)
      : (special ? "" : `<div class="bridge-row" data-row="klass"><span>특수학급 정보는 학교에 문의하세요.</span></div>`);
    const profDocK = special ? await loadSpecialProfile() : null, profK = spRow && profDocK ? profDocK.items[spRow[0]] || null : null;
    const bridge = (special ? bRow("특수학급", `<b>특수학교</b>`) + profRows(profK) : "") + klass + (!special && r[13] > 0 ? bRow("받는 장애 영역", `<span class="side">공식 자료에서 확인하지 못했어요. 특수학급이 있다고 해서 모든 장애를 받는다는 뜻은 아니니 학교에 문의하세요.</span>`, ` data-block="special-dis"`) : "")
;
    const card = schoolCard({ eyebrow: special ? "특수학교" : `일반학교 · ${r[2]}${r[13] > 0 ? " · 특수학급 있음" : ""}`, name: r[1], region, est: r[7], addr: tidy(r[10]), phone: tidy(r[11]), home: homeUrl(r[12]), office: officeMap.get(sidoOf(r[3])) || "", intro: k12Intro(r[1], r[2], r[7], r[3], lv.join(" "), r[13], K12_STATE[r[9]] || ""),
      notice: K12_STATE[r[9]] ? `<p class="notice">지금은 ${esc(K12_STATE[r[9]])}예요.</p>` : "", bridge, christian: chr, chr: chr ? chrBlock(chr, special ? "special" : "k12") : chrFlag ? chrFlagBlock(special ? "special" : "k12") : "", pending: stat ? (special ? PENDING_SPECIAL_INFO : "") : (special ? PENDING_SPECIAL : PENDING_GENERAL),
      scale: stat && !special ? scaleHtml(stat, r[13] > 0) : "", srcline: stat && special ? srcLine : "",
      loc: { id: r[0], addr: tidy(r[10]), sido: sidoOf(r[3]), sg: sgOf(r[5], r[6]), p: await loadSchoolPoint(r[0]) } });
    return { title: r[1], html: `${crumbs([["처음", "#/"], ...originCrumb(), [r[1]]])}${card}${rankBlock(rankK, r[0])}${again()}` };
  }
  async function viewOrg(id) {
    const o = await loadOrgs();
    const r = o.byId.get(id);
    if (!r) return viewNotFound();
    const home = homeUrl(r[6]), addr = tidy(r[5]);
    const line = r[2] === "training_institution" ? "일과 기술을 배우는 직업훈련 과정을 여는 곳이에요." : "누구나 배우고 모일 수 있는 평생교육 기관이에요.";
    const [chrO, rankO] = await Promise.all([loadChristian(), loadRank()]);
    const ch = chrEv(chrO, r[0], r[1], r[7] === true);
    const card = schoolCard({ eyebrow: ORG_KIND[r[2]], name: r[1], region: r[3] || "", org: true, christian: ch, est: "", addr, office: "", phone: "", home,
      intro: `${josa(r[1], "은", "는")} ${r[3] ? r[3] + "에 있는 " : ""}${ORG_KIND[r[2]]}${ie(ORG_KIND[r[2]])}.`, chr: ch ? chrBlock(ch, "org", ch !== chrO.get(r[0])) : r[7] === true ? chrFlagBlock("org") : "", bridge: `<p class="side">${line}</p>`,
      loc: { id: r[0], addr, sido: addr ? sidoOf(String(r[3] || "").split("·")[0]) : "", sg: addr ? validSg(r[4]) : "", p: null } });
    const html = `${crumbs([["처음", "#/"], ...originCrumb(), [r[1]]])}${card}${rankBlock(rankO, r[0])}${again()}`;
    return { title: r[1], html };
  }

  function viewNotFound() {
    return { title: "찾을 수 없어요", html: `<h1 tabindex="-1">찾을 수 없는 화면이에요</h1><p class="lead">주소가 바뀌었거나 없는 항목이에요.</p><p><a class="tap" href="#/">처음으로 가기</a></p>` };
  }

  /* ---------- 길 찾기 ---------- */
  function normalizeIncoming() {                                     // 달란트로드가 넘기는 ?combo=…&type=… 를 화면 주소로 바꾼다(저장·전송 없음)
    if (!location.search) return;
    const p = new URLSearchParams(location.search);
    const combo = (p.get("combo") || "").replace(/\s+/g, "+"), type = p.get("type") || "";
    const gifts = combo.split("+");
    const canonicalCombo = gifts.slice().sort().join("+");
    let target = "";
    if (/^[A-Z]\+[A-Z]\+[A-Z]$/.test(combo) && new Set(gifts).size === 3 && gifts.every(g => GIFT[g])) target = TYPES.includes(type) ? `#/mine/r/${canonicalCombo}/${type}` : `#/mine/t/${canonicalCombo}`;   // 유형이 없으면 유형 고르기('모르겠어요' 있음)로
    history.replaceState(null, "", location.pathname + (target || location.hash));
    if (target) { st.fromTalent = true; location.hash = target; }
  }

  let routeTok = 0;
  const errorView = () => ({ title: "불러오지 못했어요", html: `<h1 tabindex="-1">자료를 불러오지 못했어요</h1><p class="lead">인터넷이 느리거나 자료가 잠시 열리지 않아요.</p><p><button type="button" class="btn" id="route-retry">다시 시도</button> <a class="tap" href="#/search">다른 항목 찾아보기</a></p><p><a class="tap" href="#/">처음으로 가기</a></p>` });
  async function route() {
    const tok = ++routeTok;
    const slowTimer = setTimeout(() => { if (tok === routeTok) { $app.innerHTML = `<p class="side" data-state="loading" role="status">자료를 불러오는 중이에요(느린 인터넷에서는 조금 걸려요). 잠시만 기다려 주세요.</p>`; $live.textContent = "자료를 불러오는 중이에요"; } }, 500);
    const h = location.hash || "#/";
    let p;
    try { p = h.replace(/^#\/?/, "").split("/").map(decodeURIComponent); } catch (e) { p = ["!bad-hash"]; }   // 주소 글자가 깨졌으면 아래 가지 어디에도 안 걸려 '찾을 수 없는 화면'으로 끝난다
    let v;
    try {
      if (p[0] === "search" || !p[0]) st.fromTalent = false;
      if (p[0] === "search") { st.origin = "search"; st.lastSearch = h; st.lastJob = null; }
      else if (p[0] === "mine" || p[0] === "gifts") st.origin = "mine";
      else if (p[0] === "special" || !p[0]) st.origin = "";
      if (!p[0]) v = viewHome();
      else if ((p[0] === "mine" && !p[1]) || p[0] === "gifts") v = await viewGifts();
      else if (p[0] === "mine" && p[1] === "t") v = await viewTypes(p[2]);
      else if (p[0] === "mine" && p[1] === "r") { const sc = await loadScope(); v = sc.combos.has(p[2]) ? await viewRange(p[2], TYPES.includes(p[3]) ? p[3] : "") : await viewGifts(); }
      else if (p[0] === "jobs" && !p[1]) v = await viewJobs();
      else if (p[0] === "job") v = await viewJob(p[1]);
      else if (p[0] === "major") v = await viewMajor(p[1]);
      else if (p[0] === "school") v = await viewSchool(p[1]);
      else if (p[0] === "search" && (!p[1] || S_TABS.some(t => t[0] === p[1]))) v = viewSearch(p[1] || st.s.tab);
      else if (p[0] === "k12") v = await viewK12(p[1]);
      else if (p[0] === "org") v = await viewOrg(p[1]);
      else if (p[0] === "christian") v = await viewChristian();
      else if (p[0] === "terms") v = await viewTerms();
      else if (p[0] === "help") v = viewHelp();
      else if (p[0] === "sschool") v = await viewSpecialSchool(p[1]);
      else if (p[0] === "special" && (!p[1] || p[1] === "school" || p[1] === "class")) v = await viewSpecial(p[1] || "school");
      else v = viewNotFound();
    } catch (e) {
      v = errorView();
    }
    clearTimeout(slowTimer);
    if (tok !== routeTok) return;                                    // 더 새 화면 전환이 시작됐으면 이 결과는 버린다
    $app.innerHTML = v.html;
    document.title = v.title + " — 소명지도 Calling Map";
    $live.textContent = v.title + " 화면이에요";
    document.body.dataset.ready = h;                                  // 점검 도구가 화면이 다 그려진 때를 알아내는 표시(화면에는 보이지 않음)
    if (route.keepFocus) route.keepFocus = false;
    else { const h1 = $app.querySelector("h1"); if (h1) { h1.focus({ preventScroll: true }); window.scrollTo(0, 0); } }
  }
  async function rerender() { const y = window.scrollY; route.keepFocus = true; await route(); window.scrollTo(0, y); }

  /* ---------- 눌렀을 때 ---------- */
  $app.addEventListener("click", ev => {                               // 경계 지도(그림)에서 지역 누르기 — 키보드·화면 읽기는 글자 버튼과 선택 칸이 맡는다
    const g = ev.target.closest("path[data-tile], path[data-sg]");
    if (!g) return;
    if (g.dataset.sg && g.dataset.tilectx === "search") { st.s.sg = st.s.sg === g.dataset.sg ? "" : g.dataset.sg; st.s.shown = PAGE; sRefresh(); return; }
    if (g.dataset.sg) {
      st.sp.sg = st.sp.sg === g.dataset.sg ? "" : g.dataset.sg; st.sp.shown = PAGE;
      const sel = document.getElementById("sp-sg"); if (sel) sel.value = st.sp.sg;
      spRefresh(false); return;
    }
    const btn = document.querySelector(`button.tile[data-tile="${CSS.escape(g.dataset.tile)}"][data-tilectx="${g.dataset.tilectx}"]`);
    if (btn) btn.click();
  });
  $app.addEventListener("click", ev => {
    const t = ev.target.closest("button");
    if (!t || t.disabled) return;
    if (t.id === "loc-open") { toggleLoc(t); return; }
    if (t.id === "jobs-more") { st.jobsShown += PAGE; rerender(); return; }
    if (t.id === "route-retry") { route(); return; }
    if (t.id === "search-retry") { sRefresh(); return; }
    if (t.id === "sp-retry") { spRefresh(false); return; }
    if (t.dataset.tile) {                                               // 통합 지도에서 지역 누르기(다시 누르면 풀림)
      const s = t.dataset.tile, ctx = t.dataset.tilectx;
      if (ctx === "sp") { st.sp.sido = st.sp.sido === s ? "" : s; st.sp.sg = ""; st.sp.shown = PAGE; const sel = document.getElementById("sp-sido"); if (sel) sel.value = st.sp.sido; spRefresh(true); }
      else if (ctx === "major") { const full = [...document.querySelectorAll("#f-region option")].map(o => o.value).find(v => v && sidoOf(v) === s) || ""; st.region = st.region && sidoOf(st.region) === s ? "" : full; st.shown.schools = PAGE; rerender(); }
      else if (ctx === "search") { st.s.sido = st.s.sido === s ? "" : s; st.s.sg = ""; st.s.shown = PAGE; sRefresh(); }
      return;
    }
    if (t.dataset.scat) {                                               // 둘러보기 칩: 다시 누르면 풀림
      st.s.cat = st.s.cat === t.dataset.scat ? "" : t.dataset.scat; st.s.shown = PAGE;
      document.querySelectorAll("#ss-cats .chip").forEach(b => { const on = b.dataset.scat === st.s.cat; b.classList.toggle("active", on); b.setAttribute("aria-pressed", String(on)); });
      sRefresh(); return;
    }
    if (t.dataset.ssmore) { st.s.shown += PAGE; sRefresh(); return; }
    if (t.dataset.ssex) { st.s.q = t.dataset.ssex; st.s.shown = PAGE; const i = document.getElementById("ss-q"); if (i) { i.value = st.s.q; i.focus(); } sRefresh(); return; }
    if (t.dataset.spmore) { st.sp.shown += PAGE; spRefresh(false); return; }
    if (t.id === "sp-reset") { Object.assign(st.sp, { sido: "", sg: "", level: "", est: "", q: "", dis: [], stg: [], shown: PAGE }); rerender(); return; }
    if (t.dataset.gift) { const g = t.dataset.gift; if (st.picked.has(g)) st.picked.delete(g); else if (st.picked.size < 3) st.picked.add(g); rerender().then(() => { const b = $app.querySelector(`[data-gift="${g}"]`); if (b) b.focus({ preventScroll: true }); }); }   // 3개를 골라도 아래 MBTI 고르기를 건너뛰지 않게 화면을 내리지 않는다
    else if (t.dataset.mbti) { const m = t.dataset.mbti; st.ptype = st.ptype === m ? "" : m; rerender().then(() => { const b = $app.querySelector(`[data-mbti="${m}"]`); if (b) b.focus({ preventScroll: true }); }); }   // 다시 누르면 선택 해제
    else if (t.id === "gift-next") { if (st.picked.size === 3) location.hash = "#/mine/r/" + GIFT_ORDER.filter(g => st.picked.has(g)).sort().join("+") + (TYPES.includes(st.ptype) ? "/" + st.ptype : ""); }
    else if (t.id === "gift-reset") { st.picked.clear(); st.ptype = ""; rerender(); }
    else if (t.dataset.jump) { const h = document.getElementById(t.dataset.jump); if (h) { h.scrollIntoView({ block: "start" }); h.focus({ preventScroll: true }); } }   // 해시 라우터를 건드리지 않고 같은 화면 안에서 이동
    else if (t.dataset.field) { const f = t.dataset.field; if (st.fieldsOff.has(f)) st.fieldsOff.delete(f); else st.fieldsOff.add(f); rerender(); }
    else if (t.id === "widen") { st.wide = !st.wide; rerender(); }
    else if (t.dataset.more) { st.shown[t.dataset.more] = (st.shown[t.dataset.more] || PAGE) + PAGE; rerender(); }
  });
  $app.addEventListener("change", ev => {
    const id = ev.target.id;
    const cb = ev.target.closest && ev.target.closest("input[data-spdis], input[data-spstg]");
    if (cb) { const key = cb.hasAttribute("data-spdis") ? "dis" : "stg", v = cb.getAttribute(key === "dis" ? "data-spdis" : "data-spstg"), arr = st.sp[key], i = arr.indexOf(v); if (cb.checked && i < 0) arr.push(v); else if (!cb.checked && i >= 0) arr.splice(i, 1); st.sp.shown = PAGE; spRefresh(false); return; }
    if (id === "sp-sido") { st.sp.sido = ev.target.value; st.sp.sg = ""; st.sp.shown = PAGE; spRefresh(true); return; }
    if (id === "sp-sg" || id === "sp-level" || id === "sp-est") { st.sp[{ "sp-sg": "sg", "sp-level": "level", "sp-est": "est" }[id]] = ev.target.value; st.sp.shown = PAGE; spRefresh(false); return; }
    if (ev.target.id === "f-region") { st.region = ev.target.value; st.shown.schools = PAGE; rerender(); }
    else if (ev.target.id === "f-level") { st.level = ev.target.value; st.shown.schools = PAGE; rerender(); }
  });
  $app.addEventListener("submit", ev => {
    if (ev.target.id !== "home-search") return;
    ev.preventDefault();
    const q = (document.getElementById("hs-q").value || "").trim(), kind = document.getElementById("hs-kind").value;
    st.s.q = q; st.s.cat = ""; st.s.shown = PAGE;
    location.hash = "#/search/" + (S_TABS.some(x => x[0] === kind) ? kind : "job");
  });
  $app.addEventListener("input", ev => { if (ev.target.id === "ss-q") { st.s.q = ev.target.value; st.s.shown = PAGE; sRefresh(); } });
  $app.addEventListener("input", ev => { if (ev.target.id === "sp-q") { st.sp.q = ev.target.value; st.sp.shown = PAGE; spRefresh(false); } });
  window.addEventListener("hashchange", () => { st.shown = {}; st.sp.shown = PAGE; st.s.shown = PAGE; if (!/^#\/special\/class/.test(location.hash)) st.sp.level = ""; route(); });
  normalizeIncoming();
  route();
})();
