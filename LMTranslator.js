//=============================================================================
// LMTranslator.js  v3.14.7
// 메시지 창 단위 번역 + 밀림현상 방지 + 캐시 + 다음 메시지 프리패치 + 동시 번역
//=============================================================================
/*:
 * @target MZ
 * @plugindesc v3.14.7 | Comment/메뉴/아이템/스킬 번역 추가
 * @author Claude (Anthropic)
 *
 * @help
 * ============================================================
 *  LMTranslator v3 - 메시지 창 단위 번역
 * ============================================================
 *
 * 【동작 원리】
 *  메시지 창이 열릴 때마다 해당 창 텍스트만 번역합니다.
 *  같은 텍스트는 캐시에서 즉시 불러와 재번역하지 않습니다.
 *
 *  첫 번째 표시:
 *    창 열림 → "번역 중..." 표시 → API 호출 → 번역 결과로 교체
 *
 *  두 번째 이후:
 *    창 열림 → 캐시에서 즉시 번역문 표시 (딜레이 없음)
 *
 * 【밀림현상 방지】
 *  RPG Maker MZ 메시지 창은 기본 4줄 표시.
 *  번역 결과가 4줄 초과 시 자동으로 줄바꿈 처리합니다.
 *  - 최대 줄 수 파라미터로 조절 가능
 *  - 초과분은 다음 메시지 창으로 자동 이월 (선택)
 *  - 또는 말줄임표 처리 (선택)
 *
 * 【LM Studio 설정】
 *  LM Studio → Local Server → 모델 로드 → Start Server (포트 1234)
 *
 * 【캐릭터 성향 프롬프트】
 *  메시지 창 화자 이름 기준으로 캐릭터를 감지합니다.
 *  캐릭터 설정에서 이름, 성향, 커스텀 프롬프트를 설정하세요.
 *
 * 【프롬프트 변수】
 *  {sourceLang}  원본 언어
 *  {targetLang}  번역 대상 언어
 *  {charName}    화자 이름
 *  {personality} 캐릭터 성향
 *  {maxLines}    최대 줄 수
 *
 * ============================================================
 *
 * @param grp_api
 * @text ── API 설정 ─────────────────────
 *
 * @param apiUrl
 * @text API URL
 * @desc LM Studio 로컬 서버 주소
 * @default http://localhost:1234/v1/chat/completions
 * @parent grp_api
 *
 * @param modelName
 * @text 모델 이름
 * @desc 사용 모델 (비워두면 현재 LM Studio 로드 모델 자동 사용)
 * @default local-model
 * @parent grp_api
 *
 * @param temperature
 * @text Temperature
 * @type number
 * @decimals 2
 * @min 0
 * @max 2
 * @default 0.2
 * @parent grp_api
 *
 * @param maxTokens
 * @text 최대 토큰
 * @type number
 * @min 64
 * @max 4096
 * @default 512
 * @parent grp_api
 *
 * @param timeoutMs
 * @text 타임아웃 (ms)
 * @type number
 * @min 1000
 * @max 60000
 * @default 15000
 * @parent grp_api
 *
 * @param concurrentLimit
 * @text 동시 번역 수 (멀티스레드)
 * @desc 백그라운드/프리패치 번역 시 동시에 요청할 API 수. LM Studio가 단일 모델이면 1-2 권장
 * @type select
 * @option 1개 (순차)
 * @value 1
 * @option 2개 동시
 * @value 2
 * @option 3개 동시
 * @value 3
 * @option 4개 동시
 * @value 4
 * @option 5개 동시
 * @value 5
 * @default 1
 * @parent grp_api
 *
 * @param requestCooldownMs
 * @text 번역 요청 간격(ms)
 * @desc API 요청 1개가 끝난 뒤 다음 번역 요청을 시작하기 전 쉬는 시간. 렉이 있으면 300~1000 권장.
 * @type number
 * @min 0
 * @max 10000
 * @default 250
 * @parent grp_api
 *
 * @param prefetchLookahead
 * @text 다음 대사 선번역 개수
 * @desc 현재 메시지창이 떠 있는 동안 미리 번역할 다음 메시지 블록 수. 0이면 현재 이벤트의 남은 대사를 모두 시도합니다.
 * @type number
 * @min 0
 * @max 50
 * @default 8
 * @parent grp_api
 *
 * @param autoPretranslateJson
 * @text JSON 자동 선번역
 * @desc 게임 플레이 중 백그라운드 JSON 선번역을 자동 실행합니다. 렉이 있으면 OFF 권장. 플러그인 커맨드로 수동 실행 가능.
 * @type boolean
 * @default false
 * @parent grp_api
 *
 * @param jsonPretranslateDelay
 * @text JSON 선번역 시작 지연(ms)
 * @desc 게임 시작 후 JSON 전체 선번역을 시작하기 전 대기 시간. LM Studio 서버 준비 시간을 주고 싶으면 늘리세요.
 * @type number
 * @min 0
 * @max 60000
 * @default 3000
 * @parent grp_api
 *
 * @param grp_lang
 * @text ── 언어 설정 ─────────────────────
 *
 * @param sourceLang
 * @text 원본 언어
 * @default Japanese
 * @parent grp_lang
 *
 * @param targetLang
 * @text 번역 대상 언어
 * @default Korean
 * @parent grp_lang
 *
 * @param grp_prompt
 * @text ── 프롬프트 설정 ──────────────────
 *
 * @param systemPrompt
 * @text 기본 시스템 프롬프트
 * @desc LLM에 전달할 번역 지시문. {sourceLang} {targetLang} {maxLines} 변수 사용 가능
 * @type note
 * @default "You are a professional translator for adult RPG games. Translate the {sourceLang} text below into natural, fluent {targetLang}.\n\n[CONTENT POLICY]\n- This is a licensed adult game. All sexual, violent, and mature content MUST be translated faithfully and completely.\n- Do NOT soften, sanitize, euphemize, or omit any explicit words or expressions.\n- Vulgar, crude, or sexually explicit language must be preserved with equivalent {targetLang} expressions.\n- Moaning, exclamations, and sound effects must be kept as-is or adapted naturally.\n\n[TRANSLATION RULES]\n- Output ONLY the {targetLang} translation. Absolutely nothing else — no explanations, no notes, no source text.\n- Use natural, spoken {targetLang} that sounds like a real person, not a machine.\n- Translate the intent and emotion, not just the literal words. Preserve the original mood.\n- Keep sentence rhythm and pacing: short punchy lines stay short, flowing lines stay flowing.\n- Preserve all RPG Maker control codes exactly as-is: \\n[N], \\c[N], \\v[N], \\i[N], \\!, \\., \\|, \\>, \\<, \\^\n- The result MUST be {maxLines} lines or fewer.\n- If translation is truly impossible, output the original text unchanged."
 * @parent grp_prompt
 *
 * @param charAppendTemplate
 * @text 캐릭터 성향 추가 템플릿
 * @desc 캐릭터 성향 설정 시 시스템 프롬프트 뒤에 자동으로 추가됩니다
 * @type note
 * @default "---\nSpeaker: {charName}\nPersonality & speech style: {personality}\n\nAdapt the translation to fully match this character's unique way of speaking. Voice, vocabulary, and tone must feel distinctly like this character — not generic."
 * @parent grp_prompt
 *
 * @param characters
 * @text 캐릭터 설정
 * @type struct<Character>[]
 * @default ["{\"name\":\"아리사\",\"personality\":\"\\\"밝고 장난기가 있지만 중요한 순간에는 진지한 소녀. 말투는 친근하고 감정 표현이 풍부함.\\\"\",\"customPrompt\":\"\\\"Translate {charName}'s dialogue into natural {targetLang}. Personality: {personality}. Output only the translation. Preserve RPG Maker control codes.\\\"\"}"]
 * @parent grp_prompt
 *
 * @param nameGlossary
 * @text 이름/용어 고정표
 * @desc 한 줄에 원문=번역 형식으로 입력. 예: 夏美=나츠미. 이름 오역 방지에 사용됩니다.
 * @type note
 * @default "夏美=나츠미\n奈津美=나츠미\nナツミ=나츠미\nNatsumi=나츠미"
 * @parent grp_prompt
 *
 * @param grp_overflow
 * @text ── 밀림 방지 설정 ─────────────────
 *
 * @param maxLinesPerBox
 * @text 창당 최대 줄 수
 * @desc 메시지 창에 표시할 최대 줄 수 (RPG Maker 기본: 4)
 * @type number
 * @min 1
 * @max 10
 * @default 4
 * @parent grp_overflow
 *
 * @param wrapWidth
 * @text 줄 바꿈 기준 너비 (px)
 * @desc 한 줄이 이 너비를 넘으면 자동 줄바꿈. 0이면 자동(창 너비 기준)
 * @type number
 * @min 0
 * @max 2000
 * @default 0
 * @parent grp_overflow
 *
 * @param overflowMode
 * @text 초과 줄 처리 방식
 * @desc 번역 결과가 최대 줄 수 초과 시 처리 방법
 * @type select
 * @option 잘라내기 (초과분 삭제)
 * @value cut
 * @option 말줄임표 추가
 * @value ellipsis
 * @option 그대로 표시 (밀림 감수)
 * @value pass
 * @default ellipsis
 * @parent grp_overflow
 *
 * @param grp_ui
 * @text ── UI 설정 ──────────────────────
 *
 * @param loadingText
 * @text 번역 중 표시 텍스트
 * @desc 번역 API 호출 중 메시지 창에 표시할 텍스트
 * @default \c[8]번역 중...
 * @parent grp_ui
 *
 * @param showLoadingText
 * @text 번역 중 텍스트 표시 여부
 * @type boolean
 * @default true
 * @parent grp_ui
 *
 * @param grp_misc
 * @text ── 동작 설정 ─────────────────────
 *
 * @param enabledByDefault
 * @text 기본 활성화
 * @type boolean
 * @default true
 * @parent grp_misc
 *
 * @param fallbackToOriginal
 * @text 실패 시 원문 표시
 * @type boolean
 * @default true
 * @parent grp_misc
 *
 * @param pretranslateBeforeDisplay
 * @text 표시 전 번역
 * @desc 메시지창을 열기 전에 현재 대사를 먼저 번역합니다. 첫 표시부터 번역문을 보여주고 싶으면 ON.
 * @type boolean
 * @default true
 * @parent grp_misc
 *
 * @param translateComments
 * @text Comment/ActiveMessage 번역
 * @desc 이벤트 Comment(108/408), 특히 <ActiveMessage: ...> 안쪽 문장을 실행 전 번역합니다.
 * @type boolean
 * @default true
 * @parent grp_misc
 *
 * @param translateDatabaseText
 * @text 메뉴/DB 텍스트 번역
 * @desc 메뉴 용어, 아이템, 스킬, 장비, 상태 등 데이터베이스 텍스트를 캐시 기반으로 번역합니다.
 * @type boolean
 * @default true
 * @parent grp_misc
 *
 * @param databaseTranslateDelay
 * @text 메뉴/DB 번역 시작 지연(ms)
 * @desc 데이터베이스 로드 후 메뉴/아이템/스킬 번역을 시작하기 전 대기 시간입니다.
 * @type number
 * @min 0
 * @max 60000
 * @default 1000
 * @parent grp_misc
 *
 * @param debugMode
 * @text 디버그 모드
 * @type boolean
 * @default false
 * @parent grp_misc
 *
 * @param cacheFile
 * @text 번역 캐시 파일 경로
 * @desc 번역 결과를 저장할 JSON 파일 경로 (게임 폴더 기준 상대경로)
 * @default data/LMTranslatorCache.json
 * @parent grp_misc
 *
 * @param workCacheFile
 * @text 작업용 번역 파일 경로
 * @desc 번역 중간 결과를 모아두는 작업용 JSON 파일입니다.
 * @default data/LMTranslatorExample.json
 * @parent grp_misc
 *
 * @param cacheFlushIntervalMs
 * @text 캐시 반영 주기(ms)
 * @desc 작업용 번역 파일과 실제 캐시 파일을 디스크에 저장하는 주기입니다.
 * @type number
 * @min 1000
 * @max 300000
 * @default 30000
 * @parent grp_misc
 *
 * @param autoSaveCache
 * @text 번역 시 자동 저장
 * @desc 번역될 때마다 자동으로 JSON 파일에 저장합니다
 * @type boolean
 * @default true
 * @parent grp_misc
 *
 * @command toggleTranslation
 * @text 번역 토글
 * @desc 번역 기능 ON/OFF
 *
 * @command clearCache
 * @text 캐시 초기화
 * @desc 전체 번역 캐시 삭제
 *
 * @command setEnabled
 * @text 번역 활성화 설정
 * @arg enabled
 * @type boolean
 * @default true
 *
 * @command startJsonPretranslate
 * @text JSON 전체 선번역 시작
 * @desc data/*.json 이벤트 메시지를 지금부터 캐시에 선번역합니다.
 */

/*~struct~Character:
 * @param name
 * @text 캐릭터 이름
 * @desc 메시지 창 화자 이름과 정확히 일치
 *
 * @param personality
 * @text 성향 설명
 * @type note
 * @default ""
 *
 * @param customPrompt
 * @text 커스텀 시스템 프롬프트
 * @desc 비워두면 기본 프롬프트 + 성향 템플릿 사용
 * @type note
 * @default ""
 */

(() => {
    "use strict";
    const PLUGIN_NAME = "LMTranslator";

    //=========================================================================
    // 설정 파싱
    //=========================================================================
    const raw = PluginManager.parameters(PLUGIN_NAME);

    function numberParam(value, fallback, min, max) {
        var n = Number(value);
        if (!isFinite(n)) {
            var m = String(value || "").match(/-?\d+(\.\d+)?/);
            n = m ? Number(m[0]) : Number(fallback);
        }
        if (!isFinite(n)) n = Number(fallback);
        if (min !== undefined) n = Math.max(min, n);
        if (max !== undefined) n = Math.min(max, n);
        return n;
    }

    const Cfg = {
        apiUrl:        String(raw.apiUrl        || "http://localhost:1234/v1/chat/completions"),
        modelName:     String(raw.modelName     || "local-model"),
        temperature:   numberParam(raw.temperature   !== undefined ? raw.temperature   : 0.2, 0.2, 0, 2),
        maxTokens:     numberParam(raw.maxTokens     !== undefined ? raw.maxTokens     : 512, 512, 64, 4096),
        timeoutMs:     numberParam(raw.timeoutMs     !== undefined ? raw.timeoutMs     : 15000, 15000, 1000, 60000),
        concurrency:   numberParam(raw.concurrentLimit || 1, 1, 1, 10),
        requestCooldownMs: numberParam(raw.requestCooldownMs !== undefined ? raw.requestCooldownMs : 250, 250, 0, 10000),
        prefetchLookahead: numberParam(raw.prefetchLookahead || 8, 8, 0, 50),
        autoJson:      raw.autoPretranslateJson === "true",
        jsonDelay:     numberParam(raw.jsonPretranslateDelay !== undefined ? raw.jsonPretranslateDelay : 3000, 3000, 0, 60000),
        sourceLang:    String(raw.sourceLang    || "Japanese"),
        targetLang:    String(raw.targetLang    || "Korean"),
        sysPrompt:     (function() {
            try { return JSON.parse(raw.systemPrompt || "\"\""); } catch(e) { return String(raw.systemPrompt || ""); }
        })() || [
            "You are a professional translator for adult RPG games. Translate the {sourceLang} text below into natural, fluent {targetLang}.",
            "",
            "[CONTENT POLICY]",
            "- This is a licensed adult game. All sexual, violent, and mature content MUST be translated faithfully and completely.",
            "- Do NOT soften, sanitize, euphemize, or omit any explicit words or expressions.",
            "- Vulgar, crude, or sexually explicit language must be preserved with equivalent {targetLang} expressions.",
            "- Moaning, exclamations, and sound effects must be kept as-is or adapted naturally.",
            "",
            "[TRANSLATION RULES]",
            "- Output ONLY the {targetLang} translation. Absolutely nothing else — no explanations, no notes, no source text.",
            "- Use natural, spoken {targetLang} that sounds like a real person, not a machine.",
            "- Translate the intent and emotion, not just the literal words. Preserve the original mood.",
            "- Keep sentence rhythm and pacing: short punchy lines stay short, flowing lines stay flowing.",
            "- Preserve all RPG Maker control codes exactly as-is: \\n[N], \\c[N], \\v[N], \\i[N], \\!, \\., \\|, \\>, \\<, \\^",
            "- The result MUST be {maxLines} lines or fewer.",
            "- If translation is truly impossible, output the original text unchanged."
        ].join("\n"),
        charAppend:    (function() {
            try { return JSON.parse(raw.charAppendTemplate || "\"\""); } catch(e) { return String(raw.charAppendTemplate || ""); }
        })() || [
            "---",
            "Speaker: {charName}",
            "Personality & speech style: {personality}",
            "",
            "Adapt the translation to fully match this character's unique way of speaking. Voice, vocabulary, and tone must feel distinctly like this character — not generic."
        ].join("\n"),
        maxLines:      Math.max(1, Number(raw.maxLinesPerBox !== undefined ? raw.maxLinesPerBox : 4)),
        wrapWidth:     Number(raw.wrapWidth !== undefined ? raw.wrapWidth : 0),
        overflowMode:  String(raw.overflowMode  || "ellipsis"),
        loadingText:   String(raw.loadingText   || "\\c[8]번역 중..."),
        showLoading:   raw.showLoadingText      !== "false",
        enabled:       raw.enabledByDefault     !== "false",
        fallback:      raw.fallbackToOriginal   !== "false",
        preBeforeShow: raw.pretranslateBeforeDisplay !== "false",
        translateComments: raw.translateComments !== "false",
        translateDatabaseText: raw.translateDatabaseText !== "false",
        databaseTranslateDelay: numberParam(raw.databaseTranslateDelay !== undefined ? raw.databaseTranslateDelay : 1000, 1000, 0, 60000),
        debug:         raw.debugMode            === "true",
        cacheFile:     String(raw.cacheFile     || "data/LMTranslatorCache.json"),
        workCacheFile: String(raw.workCacheFile || "data/LMTranslatorExample.json"),
        cacheFlushInterval: numberParam(raw.cacheFlushIntervalMs !== undefined ? raw.cacheFlushIntervalMs : 30000, 30000, 1000, 300000),
        autoSave:      raw.autoSaveCache        !== "false",
        nameGlossaryRaw: (function() {
            try { return JSON.parse(raw.nameGlossary || "\"\""); } catch(e) { return String(raw.nameGlossary || ""); }
        })() || "夏美=나츠미\n奈津美=나츠미\nナツミ=나츠미\nNatsumi=나츠미",
        glossary:      [],
        characters:    []
    };

    try {
        Cfg.characters = JSON.parse(raw.characters || "[]")
            .map(s => JSON.parse(s))
            .map(c => ({
                name:    String(c.name || ""),
                persona: (function() { try { return JSON.parse(c.personality || "\"\""); } catch(e) { return String(c.personality || ""); } })(),
                custom:  (function() { try { return JSON.parse(c.customPrompt || "\"\""); } catch(e) { return String(c.customPrompt || ""); } })()
            }));
    } catch (e) {
        console.warn(`[${PLUGIN_NAME}] 캐릭터 파싱 오류:`, e);
    }

    function parseNameGlossary(rawText) {
        return String(rawText || "")
            .split(/\r?\n/)
            .map(function(line) { return line.trim(); })
            .filter(function(line) { return line && line.indexOf("=") > 0; })
            .map(function(line) {
                var pos = line.indexOf("=");
                return {
                    source: line.slice(0, pos).trim(),
                    target: line.slice(pos + 1).trim()
                };
            })
            .filter(function(item) { return item.source && item.target; });
    }

    Cfg.glossary = parseNameGlossary(Cfg.nameGlossaryRaw);

    //=========================================================================
    // 런타임 상태
    //=========================================================================
    const State = {
        enabled:       Cfg.enabled,
        cache:         new Map(),
        cacheMeta:     new Map(),
        currentInterp: null,
        currentMessageNextIndex: null,
        currentEventId: 0,
        activeMapId:   null,
        foreground:    false,   // ← 추가: 실시간 번역 진행 중 여부
        bgController:  null,    // ← 추가: 백그라운드 AbortController
        preDisplayFallback: new Set(),
        prefetching:    new Set(),
        attempted:      new Set(),
        inflight:       new Set(),
        prefetchSerial: 0,
        jsonPretranslateRunning: false,
        jsonPretranslateStarted: false,
        jsonJobToken: 0,
        currentMapPretranslateRunning: false,
        currentEventPretranslateRunning: false,
        jsonController: null,
        apiActive: 0,
        apiQueue: [],
        apiPumpTimer: null,
        nextPriorityRunning: false,
        cacheDirty: false,
        cacheFlushTimer: null,
        databaseTranslateStarted: false,
    };

    //=========================================================================
    // 헬퍼
    //=========================================================================
    const log = (...a) => { if (Cfg.debug) console.log(`[${PLUGIN_NAME}]`, ...a); };
    const info = (...a) => { if (Cfg.debug) console.info(`[${PLUGIN_NAME}]`, ...a); };

    function isKoreanTarget() {
        return /korean|한국|kor|ko/i.test(Cfg.targetLang || "");
    }

    function stripControlCodesForLanguage(text) {
        return String(text || "")
            .replace(/\\[A-Za-z]\[\d+\]/g, "")
            .replace(/\\[!.<>^|\\{}]/g, "")
            .replace(/\s+/g, "");
    }

    function hasHangul(text) {
        return /[\u1100-\u11FF\u3130-\u318F\uAC00-\uD7AF]/.test(text || "");
    }

    function hasKana(text) {
        return /[\u3040-\u30FF\u31F0-\u31FF]/.test(text || "");
    }

    function hasCjkIdeograph(text) {
        return /[\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF]/.test(text || "");
    }

    function hasTranslatableLetters(text) {
        var plain = stripControlCodesForLanguage(text);
        return /[\u3040-\u30FF\u31F0-\u31FF\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF]/.test(plain);
    }

    function escapeRegExp(text) {
        return String(text || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    }

    function isPunctuationOnly(text) {
        var plain = stripControlCodesForLanguage(text);
        return !/[A-Za-z\u3040-\u30FF\u31F0-\u31FF\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF\u1100-\u11FF\u3130-\u318F\uAC00-\uD7AF]/.test(plain);
    }

    function isWrongTargetLanguage(output, sourceText) {
        if (!isKoreanTarget()) return false;
        var out = stripControlCodesForLanguage(output);
        if (!out || isPunctuationOnly(out)) return false;

        // 한국어 대상인데 일본어 가나가 섞이면 거의 항상 모델이 언어를 놓친 것이다.
        if (hasKana(out)) return true;

        // 중국어/일본어 한자만 있고 한글이 없으면 한국어 번역으로 보지 않는다.
        if (hasCjkIdeograph(out) && !hasHangul(out)) return true;

        // 원문이 번역 가능한 문자였는데 결과에 한글이 전혀 없으면 한국어 고정 실패로 간주한다.
        if (hasTranslatableLetters(sourceText) && !hasHangul(out)) return true;

        return false;
    }

    function glossaryPromptSection() {
        if (!Cfg.glossary || Cfg.glossary.length === 0) return "";
        var lines = Cfg.glossary.map(function(item) {
            return "- " + item.source + " => " + item.target;
        });
        return [
            "",
            "[NAME / TERM GLOSSARY]",
            "- Use these Korean spellings exactly when the source contains the matching name or term.",
            "- Do not invent alternate readings for names.",
        ].concat(lines).join("\n");
    }

    function sourceContainsGlossaryTerm(sourceText, item) {
        return String(sourceText || "").indexOf(item.source) >= 0;
    }

    function applyGlossaryFixes(output, sourceText) {
        if (!output || !Cfg.glossary || Cfg.glossary.length === 0) return output;
        var fixed = String(output);

        Cfg.glossary.forEach(function(item) {
            if (!sourceContainsGlossaryTerm(sourceText, item)) return;

            // 모델이 원문 표기를 그대로 남겼다면 지정한 한국어 표기로 교체한다.
            fixed = fixed.replace(new RegExp(escapeRegExp(item.source), "g"), item.target);

            // 자주 나오는 나츠미 오독을 보정한다. 더 필요한 이름은 이름/용어 고정표에 추가하면 된다.
            if (item.target === "나츠미") {
                fixed = fixed.replace(/나테미/g, item.target);
                fixed = fixed.replace(/나쯔미/g, item.target);
                fixed = fixed.replace(/나츠메/g, item.target);
                fixed = fixed.replace(/나쓰미/g, item.target);
            }
        });

        return fixed;
    }

    function sourceTextFromCacheKey(key) {
        var text = String(key || "");
        var pos = text.indexOf("||");
        return pos >= 0 ? text.slice(pos + 2) : "";
    }

    //=========================================================================
    // JSON 파일 캐시 레이어
    // - 게임 시작 시 파일 → State.cache 로드
    // - 번역 완료 시 State.cache → 파일 저장
    //=========================================================================
    var _fs   = null;
    var _path = null;

    // NW.js 환경에서만 fs/path 사용 가능
    try {
        _fs   = require("fs");
        _path = require("path");
    } catch (e) {
        console.warn("[" + PLUGIN_NAME + "] fs 모듈 없음 - 파일 캐시 비활성화");
    }

    function _getCacheFilePath() {
        if (!_path) return null;
        return _path.join(process.cwd(), Cfg.cacheFile);
    }

    function _getWorkCacheFilePath() {
        if (!_path) return null;
        return _path.join(process.cwd(), Cfg.workCacheFile);
    }

    function _getDataDirPath() {
        if (!_path) return null;
        return _path.join(process.cwd(), "data");
    }

    function ensureJsonFileExists(filePath) {
        if (!_fs || !_path || !filePath) return;
        try {
            var dir = _path.dirname(filePath);
            if (!_fs.existsSync(dir)) {
                _fs.mkdirSync(dir, { recursive: true });
            }
            if (!_fs.existsSync(filePath)) {
                _fs.writeFileSync(filePath, "{}", "utf8");
                info("JSON 파일 생성: " + filePath);
            }
        } catch (e) {
            console.warn("[" + PLUGIN_NAME + "] JSON 파일 생성 실패 (" + filePath + "):", e.message);
        }
    }

    function ensureCacheFilesExist() {
        ensureJsonFileExists(_getWorkCacheFilePath());
        ensureJsonFileExists(_getCacheFilePath());
    }

    /** JSON 파일에서 캐시 불러오기 (게임 시작 시 1회) */
    function loadCacheFromFile() {
        if (!_fs) return;
        ensureCacheFilesExist();
        var filePath = _getWorkCacheFilePath();
        if (!_fs.existsSync(filePath)) filePath = _getCacheFilePath();
        try {
            if (_fs.existsSync(filePath)) {
                var fileRaw = _fs.readFileSync(filePath, "utf8");
                var obj = JSON.parse(fileRaw);
                var count = 0;
                Object.keys(obj).forEach(function(k) {
                    var entry = obj[k];
                    if (entry && typeof entry === "object" && entry.hasOwnProperty("translated")) {
                        var entrySourceText = entry.sourceText || sourceTextFromCacheKey(k);
                        if (entry.translated === true && isWrongTargetLanguage(entry.text || "", entrySourceText)) {
                            count++;
                            return;
                        }
                        if (entry.translated === true && entry.text) {
                            var fixedText = applyGlossaryFixes(entry.text, entrySourceText);
                            if (fixedText !== entry.text) {
                                entry = {
                                    translated: true,
                                    text: fixedText,
                                    sourceText: entrySourceText,
                                    updatedAt: Date.now()
                                };
                                State.cacheDirty = true;
                            }
                        }
                        State.cacheMeta.set(k, entry);
                        State.attempted.add(k);
                        if (entry.translated === true && entry.text) {
                            State.cache.set(k, entry.text);
                        }
                    } else {
                        var oldSourceText = sourceTextFromCacheKey(k);
                        if (isWrongTargetLanguage(entry, oldSourceText)) {
                            count++;
                            return;
                        }
                        var oldFixedText = applyGlossaryFixes(entry, oldSourceText);
                        if (oldFixedText !== entry) State.cacheDirty = true;
                        State.cache.set(k, oldFixedText);
                        State.cacheMeta.set(k, {
                            translated: true,
                            text: oldFixedText,
                            sourceText: oldSourceText,
                            updatedAt: oldFixedText !== entry ? Date.now() : 0
                        });
                        State.attempted.add(k);
                    }
                    count++;
                });
                info("파일 캐시 로드: " + count + "개 (" + filePath + ")");
            } else {
                info("캐시 파일 없음 - 새로 생성됩니다: " + filePath);
            }
        } catch (e) {
            console.warn("[" + PLUGIN_NAME + "] 캐시 파일 로드 실패:", e.message);
        }
    }

    /** 현재 State.cache 전체를 JSON 파일에 저장 */
    function writeCacheFileNow(filePath) {
        if (!_fs || !Cfg.autoSave || !filePath) return;
        try {
            // data 디렉토리가 없으면 생성
            var dir = _path.dirname(filePath);
            if (!_fs.existsSync(dir)) {
                _fs.mkdirSync(dir, { recursive: true });
            }
            var obj = {};
            State.cacheMeta.forEach(function(val, key) { obj[key] = val; });
            _fs.writeFileSync(filePath, JSON.stringify(obj, null, 2), "utf8");
            log("캐시 파일 저장 완료: " + State.cacheMeta.size + "개");
        } catch (e) {
            console.warn("[" + PLUGIN_NAME + "] 캐시 파일 저장 실패:", e.message);
        }
    }

    function flushCacheToFile() {
        if (!State.cacheDirty) return;
        writeCacheFileNow(_getWorkCacheFilePath());
        writeCacheFileNow(_getCacheFilePath());
        State.cacheDirty = false;
    }

    function scheduleCacheFlush() {
        if (!_fs || !Cfg.autoSave) return;
        State.cacheDirty = true;
        if (State.cacheFlushTimer) return;
        State.cacheFlushTimer = setTimeout(function() {
            State.cacheFlushTimer = null;
            flushCacheToFile();
        }, Cfg.cacheFlushInterval);
    }

    function saveCacheToFile() {
        scheduleCacheFlush();
    }

    // 게임 시작 시 파일 캐시 로드
    loadCacheFromFile();

    function findChar(name) {
        return Cfg.characters.find(c => c.name === name) || null;
    }

    function fill(str, vars) {
        return str.replace(/\{(\w+)\}/g, (_, k) => (vars[k] !== undefined ? vars[k] : ""));
    }

    /** 캐릭터 + 상황에 맞는 시스템 프롬프트 생성 */
    function targetLanguageLockPrompt() {
        if (!isKoreanTarget()) return "";
        return [
            "",
            "[TARGET LANGUAGE LOCK]",
            "- The final answer MUST be Korean only.",
            "- Do not output Chinese characters, Japanese kana, or the original source text.",
            "- If the source contains Chinese or Japanese, fully translate it into natural Korean Hangul.",
            "- Proper names and RPG Maker control codes may be preserved, but dialogue text must be Korean."
        ].join("\n") + glossaryPromptSection();
    }

    function buildSysPrompt(charName, maxLines, retryHint) {
        const ch   = findChar(charName);
        const vars = {
            sourceLang:  Cfg.sourceLang,
            targetLang:  Cfg.targetLang,
            charName:    charName || "",
            personality: (ch && ch.persona) ? ch.persona : "",
            maxLines:    String(maxLines)
        };
        // 캐릭터 커스텀 프롬프트 우선
        if (ch && ch.custom && ch.custom.trim()) {
            return fill(ch.custom, vars) + targetLanguageLockPrompt() + (retryHint || "");
        }
        // 기본 프롬프트 + 성향 추가
        let p = fill(Cfg.sysPrompt, vars);
        if (ch && ch.persona && Cfg.charAppend) {
            p += "\n" + fill(Cfg.charAppend, vars);
        }
        return p + targetLanguageLockPrompt() + (retryHint || "");
    }

    //=========================================================================
    // 글자 너비 측정 기반 자동 줄바꿈
    //=========================================================================

    /**
     * RPG Maker 제어코드를 제외한 실제 표시 너비 추정
     * - 한중일(CJK) 문자: fontSize px
     * - 반각(ASCII 등):   fontSize * 0.55 px
     */
    function measureLineWidth(line, fontSize) {
        // 제어코드 제거 후 순수 텍스트만 측정
        // \C[N], \V[N] 등 파라미터 있는 코드와 \!, \. 등 파라미터 없는 코드 모두 제거
        var plain = line.replace(/\\[A-Za-z]\[\d+\]|\\[!.<>^|\\{}]/g, "");
        var width = 0;
        for (var i = 0; i < plain.length; i++) {
            var code = plain.charCodeAt(i);
            // CJK Unified / Hangul / Fullwidth 범위
            if ((code >= 0x1100 && code <= 0x11FF) ||   // 한글 자모
                (code >= 0x3000 && code <= 0x9FFF) ||   // CJK / 한중일
                (code >= 0xA000 && code <= 0xD7AF) ||   // 한글 음절 등
                (code >= 0xF900 && code <= 0xFAFF) ||   // CJK 호환
                (code >= 0xFF00 && code <= 0xFFEF)) {   // 전각
                width += fontSize;
            } else {
                width += fontSize * 0.55;
            }
        }
        return width;
    }

    /**
     * 한 줄을 maxPx 너비 기준으로 여러 줄로 분할
     * 공백이 있으면 공백 기준, 없으면 글자 단위로 자름
     * 제어코드(\C[N], \V[N], \!, \. 등)는 중간에 분리하지 않음
     */
    function wrapLine(line, maxPx, fontSize) {
        if (measureLineWidth(line, fontSize) <= maxPx) return [line];

        var result  = [];
        var current = "";
        var i = 0;

        while (i < line.length) {
            // 제어코드 감지: \X[N] 또는 \X 형태
            var ctrlMatch = null;
            if (line[i] === "\\") {
                // \X[digits] 형태
                var m1 = line.slice(i).match(/^\\[A-Za-z]\[\d+\]/);
                // \X 형태 (파라미터 없음)
                var m2 = line.slice(i).match(/^\\[!.<>^|\\{}A-Za-z]/);
                ctrlMatch = m1 || m2;
            }

            if (ctrlMatch) {
                // 제어코드는 통째로 current에 붙임 (너비 0으로 취급 → 분리 안 함)
                current += ctrlMatch[0];
                i += ctrlMatch[0].length;
                continue;
            }

            var ch     = line[i];
            var test   = current + ch;
            var testPx = measureLineWidth(test, fontSize);

            if (testPx > maxPx && current.length > 0) {
                result.push(current);
                current = ch;
            } else {
                current = test;
            }
            i++;
        }
        if (current.length > 0) result.push(current);
        return result;
    }

    /**
     * 텍스트 전체에 wrapLine 적용 후 splitIntoPages
     * wrapWidth = 0 이면 자동으로 메시지 창 내부 너비 계산
     * hasFace = true 이면 얼굴 그래픽 영역만큼 텍스트 너비 감소
     */
    function wrapAndSplit(text, maxLines, hasFace) {
        // 폰트 크기: $gameSystem이 없으면 기본 26
        var fontSize = (typeof $gameSystem !== "undefined" && $gameSystem.mainFontSize)
            ? $gameSystem.mainFontSize()
            : 26;

        // 패딩
        var padding = (typeof $gameSystem !== "undefined" && $gameSystem.windowPadding)
            ? $gameSystem.windowPadding() * 2
            : 24;

        var boxWidth = (typeof Graphics !== "undefined" ? Graphics.boxWidth : 816);

        // 줄바꿈 기준 너비 결정
        var maxPx = Cfg.wrapWidth;
        if (maxPx <= 0) {
            // 자동: 창 너비 - 패딩
            maxPx = boxWidth - padding * 2 - 16;
        }

        // 얼굴 그래픽이 있으면 텍스트 영역에서 얼굴 너비 + 간격 빼기
        // RPG Maker MZ 기본 얼굴 크기: 144px + 오른쪽 여백 12px
        if (hasFace) {
            var faceWidth = (typeof ImageManager !== "undefined" && ImageManager.faceWidth)
                ? ImageManager.faceWidth + 12
                : 156;
            maxPx -= faceWidth;
            log("얼굴 그래픽 감지 → 텍스트 너비: " + maxPx + "px (얼굴 " + faceWidth + "px 제외)");
        } else {
            log("얼굴 없음 → 텍스트 너비: " + maxPx + "px");
        }

        // 각 줄에 wrapLine 적용
        var rawLines = text.split("\n");
        var wrapped  = [];
        rawLines.forEach(function(line) {
            var wLines = wrapLine(line, maxPx, fontSize);
            wLines.forEach(function(l) { wrapped.push(l); });
        });

        if (wrapped.length !== rawLines.length) {
            log("줄바꿈: " + rawLines.length + "줄 → " + wrapped.length + "줄 (maxPx=" + maxPx + ")");
        }

        // splitIntoPages
        if (wrapped.length <= maxLines) return [wrapped];
        var pages = [];
        for (var i = 0; i < wrapped.length; i += maxLines) {
            pages.push(wrapped.slice(i, i + maxLines));
        }
        log("페이지 분할: " + wrapped.length + "줄 → " + pages.length + "페이지");
        return pages;
    }

    //=========================================================================
    // 줄 초과 시 페이지 분할 (wrapAndSplit으로 통합)
    //=========================================================================
    function splitIntoPages(text, maxLines, hasFace) {
        return wrapAndSplit(text, maxLines, hasFace);
    }

    //=========================================================================
    // LM Studio API 호출
    //=========================================================================
    function scheduleApiPump(delay) {
        if (delay === 0 && State.apiPumpTimer) {
            clearTimeout(State.apiPumpTimer);
            State.apiPumpTimer = null;
        }
        if (State.apiPumpTimer) return;
        State.apiPumpTimer = setTimeout(function() {
            State.apiPumpTimer = null;
            pumpApiQueue();
        }, Math.max(0, delay || 0));
    }

    function pumpApiQueue() {
        if (State.apiPumpTimer) return;
        var limit = Math.max(1, Cfg.concurrency);
        while (State.apiActive < limit && State.apiQueue.length > 0) {
            let job = State.apiQueue.shift();
            if (job.signal && job.signal.aborted) {
                job.resolve(null);
                continue;
            }

            State.apiActive++;
            callAPIRaw(job.text, job.charName, job.signal).then(function(result) {
                job.resolve(result);
            }, function() {
                job.resolve(null);
            }).then(function() {
                State.apiActive = Math.max(0, State.apiActive - 1);
                var hasPriority = State.apiQueue.some(function(q) { return q.priority; });
                scheduleApiPump(hasPriority ? 0 : Cfg.requestCooldownMs);
            });
        }
    }

    function dropAbortedApiJobs() {
        if (!State.apiQueue || State.apiQueue.length === 0) return;
        State.apiQueue = State.apiQueue.filter(function(job) {
            if (job.signal && job.signal.aborted) {
                job.resolve(null);
                return false;
            }
            return true;
        });
    }

    function callAPI(text, charName, signal, priority) {
        return new Promise(function(resolve) {
            if (signal && signal.aborted) {
                resolve(null);
                return;
            }

            var job = {
                text: text,
                charName: charName,
                signal: signal || null,
                priority: !!priority,
                resolve: resolve
            };

            if (priority) {
                State.apiQueue.unshift(job);
            } else {
                State.apiQueue.push(job);
            }

            scheduleApiPump(priority ? 0 : Cfg.requestCooldownMs);
        });
    }

    function cleanModelOutput(content) {
        if (!content) return null;
        var out = String(content).trim();
        if (!out) return null;

        // 모델이 프롬프트 템플릿을 따라 출력한 경우 번역 라벨 뒤만 사용한다.
        var labelRe = /(?:\*\*)?\s*(?:Korean\s+Translation|Translation|번역문|한국어\s*번역)\s*:?\s*(?:\*\*)?/ig;
        var match;
        var lastEnd = -1;
        while ((match = labelRe.exec(out)) !== null) lastEnd = labelRe.lastIndex;
        if (lastEnd >= 0) {
            out = out.slice(lastEnd).trim();
        }

        // 남은 내용에 프롬프트 섹션이 그대로 있으면 출력하지 않는다.
        var leakPatterns = [
            /\[CONTENT POLICY\]/i,
            /\[TRANSLATION RULES\]/i,
            /\*\*Original Text:\*\*/i,
            /Original Text\s*:/i,
            /Output ONLY/i,
            /Preserve all RPG Maker control codes/i,
            /If translation is truly impossible/i
        ];
        for (var i = 0; i < leakPatterns.length; i++) {
            if (leakPatterns[i].test(out)) {
                log("프롬프트 유출 감지 - 응답 폐기");
                return null;
            }
        }

        out = out.replace(/^```(?:\w+)?\s*/i, "").replace(/\s*```$/i, "").trim();
        out = out.replace(/^["“”']+|["“”']+$/g, "").trim();
        return out || null;
    }

    async function callAPIRaw(text, charName, signal) {
        var timeoutController = (typeof AbortController !== "undefined") ? new AbortController() : null;
        var timeoutId = null;
    
        if (timeoutController) {
            timeoutId = setTimeout(function() {
                timeoutController.abort();
            }, Cfg.timeoutMs);
    
            // 외부 취소 신호(백그라운드 abort)가 오면 타임아웃 컨트롤러도 같이 abort
            if (signal) {
                signal.addEventListener("abort", function() {
                    timeoutController.abort();
                });
            }
        }
    
        try {
            var maxAttempts = isKoreanTarget() ? 2 : 1;
            for (var attempt = 0; attempt < maxAttempts; attempt++) {
                if (signal && signal.aborted) return null;

                var retryHint = attempt > 0
                    ? "\n\n[RETRY FIX]\nYour previous answer was not Korean. Translate again into Korean Hangul only. Return only the Korean translation."
                    : "";
                var userText = isKoreanTarget()
                    ? "Translate the following " + Cfg.sourceLang + " text into Korean only. Return only Korean translation.\n\n" + text
                    : text;

                var res = await fetch(Cfg.apiUrl, {
                    method:  "POST",
                    headers: { "Content-Type": "application/json" },
                    signal:  timeoutController ? timeoutController.signal : undefined,
                    body:    JSON.stringify({
                        model:       Cfg.modelName,
                        temperature: Math.min(Cfg.temperature, attempt > 0 ? 0.1 : Cfg.temperature),
                        max_tokens:  Cfg.maxTokens,
                        messages: [
                            { role: "system", content: buildSysPrompt(charName, Cfg.maxLines, retryHint) },
                            { role: "user",   content: userText }
                        ]
                    })
                });
        
                if (!res.ok) throw new Error("HTTP " + res.status);
                var data = await res.json();
                var content = data && data.choices && data.choices[0] &&
                              data.choices[0].message && data.choices[0].message.content;
                var cleaned = cleanModelOutput(content);
                if (cleaned) cleaned = applyGlossaryFixes(cleaned, text);
                if (cleaned && !isWrongTargetLanguage(cleaned, text)) {
                    return cleaned;
                }
                if (cleaned) {
                    log("대상 언어 불일치 감지 - 한국어로 재요청: " + cleaned.slice(0, 40));
                }
            }
            return null;
    
        } catch (e) {
            if (e.name === "AbortError") {
                var reason = (signal && signal.aborted)
                    ? "포그라운드 번역으로 인한 취소"
                    : "타임아웃(" + Cfg.timeoutMs + "ms)";
                log("API 취소 (" + reason + ")");
            } else {
                console.warn("[" + PLUGIN_NAME + "] API 실패 (" + e.message + ")");
            }
            return null;
    
        } finally {
            if (timeoutId !== null) clearTimeout(timeoutId);
        }
    }

    //=========================================================================
    // $gameMessage 현재 창 정보 수집
    //=========================================================================
    function getMessageInfo() {
        // speakerName: MZ 1.6+ API, 구버전은 빈 문자열
        var charName = (typeof $gameMessage.speakerName === "function")
            ? resolveActorNameCodes($gameMessage.speakerName() || "")
            : "";
        var extracted = extractNameTagFromText($gameMessage.allText());
        if (!charName && extracted.speakerName) charName = extracted.speakerName;
        const text = resolveActorNameCodes(extracted.text);
        return { charName, text };
    }

    /** 캐시 키: "화자이름|원문텍스트" */
    function makeCacheKey(charName, text) {
        return `${charName}||${text}`;
    }

    function shouldTranslatePlainText(text) {
        text = String(text || "").trim();
        if (!text) return false;
        if (isPunctuationOnly(text)) return false;
        return hasTranslatableLetters(text);
    }

    function cacheSpeakerForSource(source) {
        source = String(source || "");
        if (/^DB:/i.test(source)) return "DB";
        if (/^Comment:/i.test(source)) return "Comment";
        return "";
    }

    function isTranslationDoneOrBusy(key) {
        return State.cacheMeta.has(key) || State.cache.has(key) || State.attempted.has(key) || State.inflight.has(key) || State.prefetching.has(key);
    }

    function markTranslationStarted(key) {
        if (!key) return;
        State.inflight.add(key);
    }

    function markTranslationFinished(key, translated, originalText) {
        if (!key) return;
        State.inflight.delete(key);
        State.prefetching.delete(key);
        State.attempted.add(key);
        if (translated && translated.trim && translated.trim() && translated.trim() !== String(originalText || "").trim()) {
            var clean = applyGlossaryFixes(translated.trim(), originalText);
            if (isWrongTargetLanguage(clean, originalText)) {
                log("한국어가 아닌 번역 결과 폐기: " + clean.slice(0, 40));
                State.attempted.delete(key);
                return false;
            }
            State.cache.set(key, clean);
            State.cacheMeta.set(key, {
                translated: true,
                text: clean,
                sourceText: String(originalText || ""),
                updatedAt: Date.now()
            });
            return true;
        }
        State.cacheMeta.set(key, {
            translated: false,
            text: "",
            sourceText: String(originalText || ""),
            updatedAt: Date.now()
        });
        return false;
    }

    function actorNameById(id) {
        id = Number(id) || 0;
        if (id <= 0) return "";

        try {
            if (typeof $gameActors !== "undefined" && $gameActors.actor) {
                var actor = $gameActors.actor(id);
                if (actor && actor.name) return actor.name();
            }
            if (typeof $dataActors !== "undefined" && $dataActors[id]) {
                return $dataActors[id].name || "";
            }
        } catch (e) {
            log("배우 이름 조회 실패: " + id + " (" + e.message + ")");
        }
        return "";
    }

    function resolveActorNameCodes(text) {
        return String(text || "").replace(/\\[Nn]\[(\d+)\]/g, function(match, id) {
            var name = actorNameById(id);
            return name || match;
        });
    }

    function extractNameTagFromText(text) {
        text = String(text || "");
        var speaker = "";
        var cleaned = text.replace(/\\[Nn]\[(\d+)\]\s*/g, function(match, id) {
            var name = actorNameById(id);
            if (!speaker && name) speaker = name;
            return "";
        });
        return {
            speakerName: speaker,
            text: cleaned
        };
    }

    function normalizeBlock(block) {
        var speakerName = resolveActorNameCodes(block && block.speakerName ? block.speakerName : "");
        var extracted = extractNameTagFromText(block && block.text ? block.text : "");
        if (!speakerName && extracted.speakerName) speakerName = extracted.speakerName;
        return {
            speakerName: speakerName,
            text: resolveActorNameCodes(extracted.text),
            source: block && block.source ? block.source : ""
        };
    }

    function commandSpeakerName(command) {
        var params = command && command.parameters ? command.parameters : [];
        return params.length >= 5 ? resolveActorNameCodes(params[4] || "") : "";
    }

    function isEventCommandArray(value) {
        return Array.isArray(value) && value.some(function(item) {
            return item && typeof item === "object" && typeof item.code === "number" && Array.isArray(item.parameters);
        });
    }

    function activeMessageInnerText(line) {
        var m = String(line || "").match(/^(\s*<ActiveMessage\s*:\s*)([\s\S]*?)(\s*>\s*)$/i);
        return m ? m[2] : "";
    }

    function replaceActiveMessageInnerText(line, translated) {
        return String(line || "").replace(/^(\s*<ActiveMessage\s*:\s*)([\s\S]*?)(\s*>\s*)$/i, function(_, head, _body, tail) {
            return head + translated + tail;
        });
    }

    function translatableCommentText(line) {
        var inner = activeMessageInnerText(line);
        if (inner) return inner;
        return "";
    }

    function addUniqueBlock(blocks, seen, speakerName, text, source) {
        speakerName = resolveActorNameCodes(speakerName || "");
        var extracted = extractNameTagFromText(text || "");
        if (!speakerName && extracted.speakerName) speakerName = extracted.speakerName;
        text = resolveActorNameCodes(extracted.text || "");
        if (!shouldTranslatePlainText(text)) return;
        speakerName = speakerName || cacheSpeakerForSource(source);
        var key = makeCacheKey(speakerName || "", text);
        if (seen.has(key)) return;
        seen.add(key);
        blocks.push({
            speakerName: speakerName || "",
            text: text,
            source: source || ""
        });
    }

    function scanCommandListBlocks(list, source, blocks, seen) {
        if (!Array.isArray(list)) return;
        var i = 0;
        while (i < list.length) {
            var cmd = list[i];
            if (cmd && cmd.code === 101) {
                var speakerName = commandSpeakerName(cmd);
                var lines = [];
                var j = i + 1;
                while (j < list.length && list[j] && list[j].code === 401) {
                    lines.push(String(list[j].parameters[0] || ""));
                    j++;
                }
                addUniqueBlock(blocks, seen, speakerName, lines.join("\n"), source);
                i = j;
            } else if (cmd && cmd.code === 105) {
                var scrollLines = [];
                var sj = i + 1;
                while (sj < list.length && list[sj] && list[sj].code === 405) {
                    scrollLines.push(String(list[sj].parameters[0] || ""));
                    sj++;
                }
                addUniqueBlock(blocks, seen, "", scrollLines.join("\n"), source);
                i = sj;
            } else if (Cfg.translateComments && cmd && cmd.code === 108) {
                addUniqueBlock(blocks, seen, "Comment", translatableCommentText(String(cmd.parameters[0] || "")), "Comment:" + source);
                var cj = i + 1;
                while (cj < list.length && list[cj] && list[cj].code === 408) {
                    addUniqueBlock(blocks, seen, "Comment", translatableCommentText(String(list[cj].parameters[0] || "")), "Comment:" + source);
                    cj++;
                }
                i = cj;
            } else {
                i++;
            }
        }
    }

    function scanJsonObjectForMessages(value, source, blocks, seen) {
        if (!value || typeof value !== "object") return;

        if (isEventCommandArray(value)) {
            scanCommandListBlocks(value, source, blocks, seen);
            return;
        }

        if (Array.isArray(value)) {
            value.forEach(function(item) {
                scanJsonObjectForMessages(item, source, blocks, seen);
            });
            return;
        }

        Object.keys(value).forEach(function(k) {
            scanJsonObjectForMessages(value[k], source, blocks, seen);
        });
    }

    function readMessageBlockFromInterpreter(interp) {
        if (!interp || !interp._list) return null;
        var list = interp._list;
        var index = interp._index || 0;
        var command = list[index];
        if (!command || command.code !== 101) return null;

        var lines = [];
        var i = index + 1;
        while (i < list.length && list[i].code === 401) {
            lines.push(list[i].parameters[0]);
            i++;
        }

        if (lines.length === 0) return null;
        var normalized = normalizeBlock({
            speakerName: commandSpeakerName(command),
            text: lines.join("\n")
        });
        return {
            index: index,
            nextIndex: i,
            speakerName: normalized.speakerName,
            text: normalized.text
        };
    }

    function rememberCurrentInterpreter(interp, eventId) {
        if (!interp || !interp._list) return;
        State.currentInterp = interp;
        if (eventId !== undefined && eventId !== null) {
            State.currentEventId = Number(eventId) || 0;
        } else if (interp._eventId !== undefined) {
            State.currentEventId = Number(interp._eventId) || 0;
        }
    }

    function schedulePrefetch(interp, options) {
        if (!State.enabled || !interp || !interp._list) return;
        setTimeout(function() {
            prefetchNext(interp, options || {});
        }, 0);
    }

    //=========================================================================
    // 다음 메시지 블록 미리보기 (인터프리터 커맨드 리스트 스캔)
    //=========================================================================

    /**
     * 현재 인터프리터의 _list에서 현재 위치 이후
     * 남아있는 모든 101+401 메시지 블록을 배열로 반환
     */
    function peekAllBlocks(interp, startIndex) {
        if (!interp || !interp._list) return [];
        const list   = interp._list;
        const blocks = [];
        let i = startIndex !== undefined ? startIndex : (interp._index + 1);

        // 현재 창에 속한 401 줄들 먼저 건너뛰기
        while (i < list.length && list[i].code === 401) i++;

        // 이후 모든 101 블록 수집
        while (i < list.length) {
            if (list[i].code === 101) {
                const speakerName = commandSpeakerName(list[i]);
                const lines = [];
                let j = i + 1;
                while (j < list.length && list[j].code === 401) {
                    lines.push(list[j].parameters[0]);
                    j++;
                }
                if (lines.length > 0) {
                    blocks.push(normalizeBlock({ speakerName, text: lines.join("\n") }));
                }
                i = j;
            } else if (Cfg.translateComments && list[i].code === 108) {
                var commentText = translatableCommentText(list[i].parameters[0] || "");
                if (shouldTranslatePlainText(commentText)) {
                    blocks.push(normalizeBlock({ speakerName: "Comment", text: commentText, source: "Comment" }));
                }
                let cj = i + 1;
                while (cj < list.length && list[cj].code === 408) {
                    var commentMore = translatableCommentText(list[cj].parameters[0] || "");
                    if (shouldTranslatePlainText(commentMore)) {
                        blocks.push(normalizeBlock({ speakerName: "Comment", text: commentMore, source: "Comment" }));
                    }
                    cj++;
                }
                i = cj;
            } else {
                i++;
            }
        }
        return blocks;
    }

    function eventBlocksFromInterpreter(interp, eventId, startIndex) {
        var blocks = peekAllBlocks(interp, startIndex !== undefined ? startIndex : 0);
        var mapId = State.activeMapId || (typeof $gameMap !== "undefined" && $gameMap.mapId ? $gameMap.mapId() : 0);
        var source = "Map" + mapId + " Event" + (eventId || 0);
        return blocks.map(function(b) {
            return {
                speakerName: b.speakerName,
                text: b.text,
                source: source
            };
        });
    }

    /**
     * 현재 이후 남은 모든 메시지 블록을 백그라운드에서 병렬 번역
     * - 이미 캐시된 항목은 건너뜀
     * - 로딩 표시 없이 조용히 실행
     */
    function prefetchNext(interp, options) {
        if (!State.enabled) return false;
        options = options || {};

        if (options.restart !== false && State.bgController) {
            State.bgController.abort();
            State.bgController = null;
            State.prefetching.clear();
        }

        const blocks = peekAllBlocks(interp, options.startIndex);
        if (blocks.length === 0) {
            if (options.priority) info("다음 대사 선번역: 후보 없음 (startIndex=" + options.startIndex + ")");
            return false;
        }

        var limit = options.limit !== undefined ? Number(options.limit) : Cfg.prefetchLookahead;
        var scope = limit > 0 ? blocks.slice(0, limit) : blocks;
    
        const pending = scope.map(normalizeBlock).filter(function(b) {
            var key = makeCacheKey(b.speakerName, b.text);
            return !isTranslationDoneOrBusy(key);
        });
        if (pending.length === 0) {
            var skipMsg = "다음 대사 선번역 스킵 (" + scope.length + "개 모두 캐시/진행 중)";
            if (options.priority) info(skipMsg);
            else log(skipMsg);
            return false;
        }
    
        var startMsg = "다음 대사 선번역 시작: " + pending.length + "개 (검사 " + scope.length + "개 / 전체 " + blocks.length + "개)";
        if (options.priority) info(startMsg);
        else log(startMsg);

        if (State.foreground && !options.allowForeground) {
            log("다음 대사 선번역 예약 취소: 현재 표시 대사 번역 중");
            return false;
        }

        if (options.restart === false && State.bgController) {
            log("다음 대사 선번역 스킵 (이미 진행 중)");
            return false;
        }

        // 새 AbortController 등록
        var controller = (typeof AbortController !== "undefined") ? new AbortController() : null;
        State.bgController = controller;
        var signal = controller ? controller.signal : null;
        var serial = ++State.prefetchSerial;
    
        (async () => {
            const N = Cfg.concurrency;
            for (var ci = 0; ci < pending.length; ci += N) {
                // 포그라운드 번역이 시작됐거나 외부에서 취소됐으면 즉시 중단
                if (State.foreground && !options.allowForeground) {
                    log("다음 대사 선번역 중단: 현재 표시 대사 번역 우선");
                    break;
                }
                if (signal && signal.aborted) {
                    log("다음 대사 선번역 취소됨");
                    break;
                }

                // N개짜리 청크 추출 후 루프 중 캐시된 항목 재필터
                var chunk = pending.slice(ci, ci + N).map(normalizeBlock).filter(function(b) {
                    var key = makeCacheKey(b.speakerName, b.text);
                    return !isTranslationDoneOrBusy(key);
                });
                if (chunk.length === 0) continue;
                chunk.forEach(function(b) {
                    var key = makeCacheKey(b.speakerName, b.text);
                    State.prefetching.add(key);
                    markTranslationStarted(key);
                });

                log("다음 대사 선번역: " + chunk.length + "개 (동시 한도 " + N + ")");

                // N개 동시 API 호출
                var results = await Promise.all(chunk.map(function(b) {
                    return callAPI(b.text, b.speakerName, signal, !!options.priority);
                }));

                // API 응답 후에도 다시 체크
                if ((State.foreground && !options.allowForeground) || (signal && signal.aborted)) {
                    log("다음 대사 선번역 중단: 현재 표시 대사 번역 우선 (응답 후)");
                    break;
                }

                // 결과 일괄 캐시 저장
                chunk.forEach(function(block, idx) {
                    var translated = results[idx] ? results[idx].trim() : null;
                    var key = makeCacheKey(block.speakerName, block.text);
                    if (markTranslationFinished(key, translated, block.text)) {
                        log("다음 대사 선번역 완료 [" + (block.speakerName || "?") + "]: " + translated.slice(0, 40));
                    } else {
                        log("다음 대사 선번역 실패/동일 [" + (block.speakerName || "?") + "] - 재번역 방지");
                    }
                });
                saveCacheToFile(); // 청크 단위로 1회 저장
            }
            if (State.bgController === controller && State.prefetchSerial === serial) {
                State.bgController = null;
            }
            log("다음 대사 선번역 완료 (또는 중단)");
            if (options.onComplete) options.onComplete();
        })();
        return true;
    }

    function prefetchNextThenResumeJson(interp, options) {
        options = options || {};
        options.onComplete = function() {
            State.nextPriorityRunning = false;
            resumeJsonPretranslateAfterForeground();
        };

        var started = prefetchNext(interp, options);
        if (!started) {
            State.nextPriorityRunning = false;
            resumeJsonPretranslateAfterForeground();
        }
    }

    function prioritizeNextMessages(interp, startIndex) {
        if (!State.enabled) return;
        if (!interp || !interp._list) return;

        // 메시지창이 떠 있는 동안에는 전체/맵 JSON 번역보다 다음 대사가 우선이다.
        // 이전 우선 프리패치가 남아 있어도 현재 메시지 기준으로 다시 시작한다.
        if (State.bgController) {
            State.bgController.abort();
            State.bgController = null;
            State.prefetching.clear();
        }
        State.nextPriorityRunning = true;
        State.jsonJobToken++;
        State.jsonPretranslateStarted = false;
        State.jsonPretranslateRunning = false;
        State.currentMapPretranslateRunning = false;
        if (State.jsonController) {
            State.jsonController.abort();
            State.jsonController = null;
        }
        dropAbortedApiJobs();
        info("다음 메시지 최우선 선번역 요청 (eventId=" + State.currentEventId + ", startIndex=" + startIndex + ")");

        prefetchNextThenResumeJson(interp, {
            startIndex: startIndex,
            allowForeground: true,
            priority: true,
            restart: true
        });
    }

    //=========================================================================
    // 맵 전체 메시지 백그라운드 순차 번역
    // - Scene_Map 시작 시 $dataMap 전체 이벤트 스캔
    // - 캐시 없는 메시지만 1개씩 순차 번역 → 캐시 저장
    // - 게임 진행 차단 없이 백그라운드에서 조용히 실행
    //=========================================================================

    /**
     * $dataMap.events 전체에서 모든 메시지 블록 추출
     */
    function scanMapBlocks(mapData) {
        var blocks = [];
        var seen = new Set();
        if (!mapData || !mapData.events) return blocks;

        mapData.events.forEach(function(ev) {
            if (!ev) return;
            ev.pages.forEach(function(page) {
                if (!page || !page.list) return;
                scanCommandListBlocks(page.list, "Map", blocks, seen);
            });
        });
        return blocks;
    }

    /**
     * 맵의 모든 메시지를 백그라운드에서 1개씩 순차 번역
     */
    async function pretranslateMapBackground(mapData, mapId) {
        if (!State.enabled) return;
        if (State.jsonPretranslateRunning) {
            log("MAP" + mapId + ": JSON 전체 선번역 진행 중 - 맵 단위 번역 스킵");
            return;
        }

        var blocks  = scanMapBlocks(mapData);
        var pending = blocks.filter(function(b) {
            b = normalizeBlock(b);
            return !isTranslationDoneOrBusy(makeCacheKey(b.speakerName, b.text));
        });

        if (pending.length === 0) {
            log("MAP" + mapId + ": 번역할 메시지 없음 (전체 캐시됨)");
            return;
        }

        log("MAP" + mapId + ": 백그라운드 번역 시작 - " + pending.length + "개 (전체 " + blocks.length + "개 중 미캐시)");

        var N = Cfg.concurrency;
        for (var i = 0; i < pending.length; i += N) {
            // 현재 맵이 바뀌었으면 즉시 중단
            if (State.activeMapId !== mapId) {
                log("MAP" + mapId + ": 백그라운드 번역 중단 → 현재 맵은 MAP" + State.activeMapId);
                return;
            }
            if (State.foreground) {
                log("MAP" + mapId + ": 백그라운드 번역 중단 → 표시 전/실시간 번역 우선");
                return;
            }

            // N개짜리 청크 추출 후 루프 중 캐시된 항목 재필터
            var chunk = pending.slice(i, i + N).filter(function(b) {
                b = normalizeBlock(b);
                return !isTranslationDoneOrBusy(makeCacheKey(b.speakerName, b.text));
            }).map(normalizeBlock);
            if (chunk.length === 0) continue;
            chunk.forEach(function(b) {
                markTranslationStarted(makeCacheKey(b.speakerName, b.text));
            });

            log("MAP" + mapId + " [" + (i + 1) + "~" + Math.min(i + N, pending.length) + "/" + pending.length + "] 동시 번역 " + chunk.length + "개");

            // N개 동시 API 호출
            var results = await Promise.all(chunk.map(function(b) {
                return callAPI(b.text, b.speakerName);
            }));

            // API 응답 후 맵 전환 재확인
            if (State.activeMapId !== mapId) {
                log("MAP" + mapId + ": 번역 응답 수신 후 맵 전환 감지 → 중단");
                return;
            }
            if (State.foreground) {
                log("MAP" + mapId + ": 번역 응답 수신 후 실시간 번역 감지 → 중단");
                return;
            }

            // 결과 일괄 처리 및 캐시 저장 (청크 당 1회)
            chunk.forEach(function(block, idx) {
                var translated = results[idx] ? results[idx].trim() : null;
                var key = makeCacheKey(block.speakerName, block.text);
                if (markTranslationFinished(key, translated, block.text)) {
                    log("MAP" + mapId + " [" + (block.speakerName || "?") + "]: " + translated.slice(0, 40));
                } else {
                    log("MAP" + mapId + " [" + (block.speakerName || "?") + "] 번역 실패/동일 - 재번역 방지");
                }
            });
            saveCacheToFile();
        }

        log("MAP" + mapId + ": 백그라운드 번역 완료");
    }

    function readAllDataJsonMessageBlocks() {
        var blocks = [];
        var seen = new Set();
        if (!_fs || !_path) {
            console.warn("[" + PLUGIN_NAME + "] fs/path 사용 불가 - JSON 전체 선번역 비활성");
            return blocks;
        }

        var dataDir = _getDataDirPath();
        if (!_fs.existsSync(dataDir)) {
            console.warn("[" + PLUGIN_NAME + "] data 폴더를 찾을 수 없음: " + dataDir);
            return blocks;
        }

        var cacheFull = _path.normalize(_getCacheFilePath() || "");
        var files = _fs.readdirSync(dataDir).filter(function(name) {
            if (!/\.json$/i.test(name)) return false;
            var full = _path.normalize(_path.join(dataDir, name));
            if (full === cacheFull) return false;
            if (/^LMTranslatorCache\.json$/i.test(name)) return false;
            if (/^LMTranslatorExample\.json$/i.test(name)) return false;
            return true;
        });

        files.forEach(function(name) {
            var filePath = _path.join(dataDir, name);
            try {
                var data = JSON.parse(_fs.readFileSync(filePath, "utf8"));
                scanJsonObjectForMessages(data, name, blocks, seen);
            } catch (e) {
                log("JSON 스캔 스킵: " + name + " (" + e.message + ")");
            }
        });

        return blocks;
    }

    function mapFileName(mapId) {
        var s = String(mapId);
        while (s.length < 3) s = "0" + s;
        return "Map" + s + ".json";
    }

    async function translateBlocksToCache(blocks, label, options) {
        if (!State.enabled || !blocks || blocks.length === 0) return;
        options = options || {};

        var pending = blocks.map(normalizeBlock).filter(function(b) {
            return !isTranslationDoneOrBusy(makeCacheKey(b.speakerName, b.text));
        });

        if (pending.length === 0) {
            info(label + ": 번역할 항목 없음 (전체 캐시됨)");
            return;
        }

        info(label + ": 번역 시작 " + pending.length + "개 / 전체 " + blocks.length + "개");

        var N = Math.max(1, Cfg.concurrency);
        var controller = (typeof AbortController !== "undefined") ? new AbortController() : null;
        State.jsonController = controller;
        var signal = controller ? controller.signal : null;

        for (var i = 0; i < pending.length; i += N) {
            if (options.shouldStop && options.shouldStop()) {
                info(label + ": 우선순위 변경으로 중단");
                if (State.jsonController === controller) State.jsonController = null;
                return "stopped";
            }

            var chunk = pending.slice(i, i + N).map(normalizeBlock).filter(function(b) {
                return !isTranslationDoneOrBusy(makeCacheKey(b.speakerName, b.text));
            });
            if (chunk.length === 0) continue;
            chunk.forEach(function(b) {
                markTranslationStarted(makeCacheKey(b.speakerName, b.text));
            });

            log(label + ": " + (i + 1) + "~" + Math.min(i + N, pending.length) + "/" + pending.length + " 번역 중");

            var results = await Promise.all(chunk.map(function(b) {
                return callAPI(b.text, b.speakerName, signal);
            }));

            if (options.shouldStop && options.shouldStop()) {
                info(label + ": 응답 수신 후 우선순위 변경 감지");
                if (State.jsonController === controller) State.jsonController = null;
                return "stopped";
            }

            chunk.forEach(function(block, idx) {
                var translated = results[idx] ? results[idx].trim() : null;
                var key = makeCacheKey(block.speakerName, block.text);
                if (markTranslationFinished(key, translated, block.text)) {
                    log(label + " 완료 [" + (block.source || "?") + " / " + (block.speakerName || "?") + "]: " + translated.slice(0, 40));
                } else {
                    log(label + " 실패/동일 [" + (block.source || "?") + " / " + (block.speakerName || "?") + "] - 재번역 방지");
                }
            });

            saveCacheToFile();
        }

        saveCacheToFile();
        if (State.jsonController === controller) State.jsonController = null;
        info(label + ": 번역 완료. 현재 캐시 상태 " + State.cacheMeta.size + "개");
        return "done";
    }

    function startJsonPretranslate(delayOverride) {
        if (!State.enabled || !Cfg.autoJson || State.jsonPretranslateStarted) return;
        State.jsonPretranslateStarted = true;
        var delay = delayOverride !== undefined ? delayOverride : Cfg.jsonDelay;
        var scheduledToken = State.jsonJobToken;

        setTimeout(function() {
            if (scheduledToken !== State.jsonJobToken || State.currentMapPretranslateRunning) return;
            if (State.jsonPretranslateRunning) return;
            State.jsonPretranslateRunning = true;
            var token = ++State.jsonJobToken;

            var blocks = readAllDataJsonMessageBlocks();
            info("JSON 전체 선번역: 메시지 블록 " + blocks.length + "개 발견");

            translateBlocksToCache(blocks, "JSON 전체 선번역", {
                shouldStop: function() {
                    return State.foreground || State.currentEventPretranslateRunning || token !== State.jsonJobToken || State.currentMapPretranslateRunning;
                }
            }).then(function() {
                State.jsonPretranslateRunning = false;
            }, function(e) {
                State.jsonPretranslateRunning = false;
                console.warn("[" + PLUGIN_NAME + "] JSON 전체 선번역 실패:", e.message);
            });
        }, delay);
    }

    function startJsonPretranslateManual(delayOverride) {
        var old = Cfg.autoJson;
        Cfg.autoJson = true;
        State.jsonPretranslateStarted = false;
        startJsonPretranslate(delayOverride);
        Cfg.autoJson = old;
    }

    function startCurrentMapThenGlobalPretranslate(mapData, mapId, delayOverride) {
        if (!State.enabled || !Cfg.autoJson || !mapData) return;

        var token = ++State.jsonJobToken;
        State.currentMapPretranslateRunning = true;
        State.currentEventPretranslateRunning = false;
        State.jsonPretranslateStarted = true;
        var delay = delayOverride !== undefined ? delayOverride : Cfg.jsonDelay;
        if (State.jsonController) {
            State.jsonController.abort();
            State.jsonController = null;
        }
        dropAbortedApiJobs();

        setTimeout(function() {
            if (token !== State.jsonJobToken || State.activeMapId !== mapId) return;
            var blocks = scanMapBlocks(mapData).map(function(b) {
                b.source = mapFileName(mapId);
                return b;
            });
            info("현재 맵 우선 선번역 MAP" + mapId + ": 메시지 블록 " + blocks.length + "개 발견");

            translateBlocksToCache(blocks, "현재 맵 우선 선번역 MAP" + mapId, {
                shouldStop: function() {
                    return State.foreground || State.currentEventPretranslateRunning || token !== State.jsonJobToken || State.activeMapId !== mapId;
                }
            }).then(function() {
                if (token !== State.jsonJobToken || State.activeMapId !== mapId) return;
                State.currentMapPretranslateRunning = false;
                State.jsonPretranslateRunning = false;
                State.jsonPretranslateStarted = false;
                startJsonPretranslate(0);
            }, function(e) {
                State.currentMapPretranslateRunning = false;
                console.warn("[" + PLUGIN_NAME + "] 현재 맵 우선 선번역 실패:", e.message);
                if (token === State.jsonJobToken && State.activeMapId === mapId) {
                    State.jsonPretranslateRunning = false;
                    State.jsonPretranslateStarted = false;
                    startJsonPretranslate(0);
                }
            });
        }, delay);
    }

    function startCurrentEventThenMapThenGlobalPretranslate(interp, eventId, delayOverride, startIndex) {
        if (!State.enabled || !Cfg.autoJson || !interp || !interp._list) return;

        var mapId = State.activeMapId || (typeof $gameMap !== "undefined" && $gameMap.mapId ? $gameMap.mapId() : 0);
        var token = ++State.jsonJobToken;
        var delay = delayOverride !== undefined ? delayOverride : 0;

        State.currentEventId = Number(eventId) || 0;
        State.currentEventPretranslateRunning = true;
        State.currentMapPretranslateRunning = false;
        State.jsonPretranslateRunning = false;
        State.jsonPretranslateStarted = true;

        if (State.jsonController) {
            State.jsonController.abort();
            State.jsonController = null;
        }
        dropAbortedApiJobs();

        setTimeout(function() {
            if (token !== State.jsonJobToken || State.activeMapId !== mapId) return;

            var blocks = eventBlocksFromInterpreter(interp, eventId, startIndex !== undefined ? startIndex : 0);
            info("현재 이벤트 ID " + (eventId || 0) + " 우선 선번역: 메시지 블록 " + blocks.length + "개 발견");

            translateBlocksToCache(blocks, "현재 이벤트 ID " + (eventId || 0) + " 우선 선번역", {
                shouldStop: function() {
                    return State.foreground || token !== State.jsonJobToken || State.activeMapId !== mapId;
                }
            }).then(function() {
                if (token !== State.jsonJobToken || State.activeMapId !== mapId) return;
                State.currentEventPretranslateRunning = false;
                State.currentMapPretranslateRunning = false;
                State.jsonPretranslateRunning = false;
                State.jsonPretranslateStarted = false;
                if (typeof $dataMap !== "undefined" && $dataMap) {
                    startCurrentMapThenGlobalPretranslate($dataMap, mapId, 0);
                } else {
                    startJsonPretranslate(0);
                }
            }, function(e) {
                State.currentEventPretranslateRunning = false;
                console.warn("[" + PLUGIN_NAME + "] 현재 이벤트 ID " + (eventId || 0) + " 우선 선번역 실패:", e.message);
                if (token === State.jsonJobToken && State.activeMapId === mapId) {
                    State.currentMapPretranslateRunning = false;
                    State.jsonPretranslateRunning = false;
                    State.jsonPretranslateStarted = false;
                    if (typeof $dataMap !== "undefined" && $dataMap) {
                        startCurrentMapThenGlobalPretranslate($dataMap, mapId, 0);
                    } else {
                        startJsonPretranslate(0);
                    }
                }
            });
        }, delay);
    }

    function resumeJsonPretranslateAfterForeground() {
        if (!State.enabled || !Cfg.autoJson) return;
        if (State.foreground) return;
        if (typeof $dataMap === "undefined" || typeof $gameMap === "undefined") return;

        var mapId = State.activeMapId || ($gameMap && $gameMap.mapId ? $gameMap.mapId() : 0);
        if (!mapId || !$dataMap) return;

        State.jsonPretranslateRunning = false;
        State.currentEventPretranslateRunning = false;
        State.currentMapPretranslateRunning = false;
        State.jsonPretranslateStarted = false;
        if (Cfg.autoJson) startCurrentMapThenGlobalPretranslate($dataMap, mapId, 0);
    }

    function addDatabaseStringTask(tasks, obj, prop, source) {
        if (!obj || obj[prop] === undefined || obj[prop] === null) return;
        var original = String(obj[prop]);
        if (!shouldTranslatePlainText(original)) return;

        var key = makeCacheKey("DB", original);
        if (State.cache.has(key)) {
            obj[prop] = State.cache.get(key);
            return;
        }
        if (isTranslationDoneOrBusy(key)) return;
        tasks.push({
            obj: obj,
            prop: prop,
            original: original,
            source: source || "DB"
        });
    }

    function addDatabaseArrayTasks(tasks, arr, source) {
        if (!Array.isArray(arr)) return;
        for (var i = 0; i < arr.length; i++) {
            addDatabaseStringTask(tasks, arr, i, source + "[" + i + "]");
        }
    }

    function addDatabaseObjectStringTasks(tasks, obj, source) {
        if (!obj || typeof obj !== "object") return;
        Object.keys(obj).forEach(function(k) {
            if (typeof obj[k] === "string") {
                addDatabaseStringTask(tasks, obj, k, source + "." + k);
            } else if (Array.isArray(obj[k])) {
                addDatabaseArrayTasks(tasks, obj[k], source + "." + k);
            } else if (obj[k] && typeof obj[k] === "object") {
                addDatabaseObjectStringTasks(tasks, obj[k], source + "." + k);
            }
        });
    }

    function collectDatabaseTextTasks() {
        var tasks = [];

        function eachData(arr, source, fields) {
            if (!Array.isArray(arr)) return;
            arr.forEach(function(item) {
                if (!item) return;
                fields.forEach(function(field) {
                    addDatabaseStringTask(tasks, item, field, source + "." + field);
                });
            });
        }

        if (typeof $dataSystem !== "undefined" && $dataSystem) {
            addDatabaseStringTask(tasks, $dataSystem, "gameTitle", "DB:System.gameTitle");
            addDatabaseStringTask(tasks, $dataSystem, "currencyUnit", "DB:System.currencyUnit");
            addDatabaseArrayTasks(tasks, $dataSystem.elements, "DB:System.elements");
            addDatabaseArrayTasks(tasks, $dataSystem.skillTypes, "DB:System.skillTypes");
            addDatabaseArrayTasks(tasks, $dataSystem.weaponTypes, "DB:System.weaponTypes");
            addDatabaseArrayTasks(tasks, $dataSystem.armorTypes, "DB:System.armorTypes");
            addDatabaseArrayTasks(tasks, $dataSystem.equipTypes, "DB:System.equipTypes");
            addDatabaseObjectStringTasks(tasks, $dataSystem.terms, "DB:System.terms");
        }

        if (typeof $dataActors !== "undefined") eachData($dataActors, "DB:Actors", ["name", "nickname", "profile"]);
        if (typeof $dataClasses !== "undefined") eachData($dataClasses, "DB:Classes", ["name"]);
        if (typeof $dataSkills !== "undefined") eachData($dataSkills, "DB:Skills", ["name", "description", "message1", "message2"]);
        if (typeof $dataItems !== "undefined") eachData($dataItems, "DB:Items", ["name", "description"]);
        if (typeof $dataWeapons !== "undefined") eachData($dataWeapons, "DB:Weapons", ["name", "description"]);
        if (typeof $dataArmors !== "undefined") eachData($dataArmors, "DB:Armors", ["name", "description"]);
        if (typeof $dataEnemies !== "undefined") eachData($dataEnemies, "DB:Enemies", ["name"]);
        if (typeof $dataStates !== "undefined") eachData($dataStates, "DB:States", ["name", "message1", "message2", "message3", "message4"]);

        return tasks;
    }

    async function translateDatabaseTextBackground() {
        if (!State.enabled || !Cfg.translateDatabaseText) return;
        var tasks = collectDatabaseTextTasks();
        if (tasks.length === 0) {
            info("메뉴/DB 텍스트 번역: 번역할 항목 없음");
            return;
        }

        var grouped = {};
        tasks.forEach(function(task) {
            var key = makeCacheKey("DB", task.original);
            if (!grouped[key]) grouped[key] = [];
            grouped[key].push(task);
        });
        var uniqueTasks = Object.keys(grouped).map(function(key) {
            return grouped[key][0];
        });

        info("메뉴/DB 텍스트 번역 시작: " + uniqueTasks.length + "개 (적용 위치 " + tasks.length + "개)");
        var N = Math.max(1, Cfg.concurrency);
        for (var i = 0; i < uniqueTasks.length; i += N) {
            var chunk = uniqueTasks.slice(i, i + N).filter(function(task) {
                return !isTranslationDoneOrBusy(makeCacheKey("DB", task.original));
            });
            if (chunk.length === 0) continue;
            chunk.forEach(function(task) {
                markTranslationStarted(makeCacheKey("DB", task.original));
            });

            var results = await Promise.all(chunk.map(function(task) {
                return callAPI(task.original, "DB");
            }));

            chunk.forEach(function(task, idx) {
                var translated = results[idx] ? results[idx].trim() : null;
                var key = makeCacheKey("DB", task.original);
                if (markTranslationFinished(key, translated, task.original) && State.cache.has(key)) {
                    grouped[key].forEach(function(target) {
                        target.obj[target.prop] = State.cache.get(key);
                    });
                }
            });
            saveCacheToFile();
        }
        saveCacheToFile();
        info("메뉴/DB 텍스트 번역 완료");
    }

    function scheduleDatabaseTextTranslation() {
        if (!State.enabled || !Cfg.translateDatabaseText || State.databaseTranslateStarted) return;
        State.databaseTranslateStarted = true;
        setTimeout(function() {
            translateDatabaseTextBackground();
        }, Cfg.databaseTranslateDelay);
    }

    if (typeof Scene_Boot !== "undefined" && Scene_Boot.prototype.start) {
        var _Scene_Boot_start = Scene_Boot.prototype.start;
        Scene_Boot.prototype.start = function() {
            _Scene_Boot_start.call(this);
            scheduleDatabaseTextTranslation();
        };
    }

    //=========================================================================
    // Scene_Map 패치 - 맵 로드 완료 시 백그라운드 번역 시작
    //=========================================================================
    var _Scene_Map_onMapLoaded = Scene_Map.prototype.onMapLoaded;
    Scene_Map.prototype.onMapLoaded = function() {
        _Scene_Map_onMapLoaded.call(this);

        var mapId   = $gameMap.mapId();
        var mapData = $dataMap;

        // 현재 활성 맵 ID 갱신 → 이전 맵 번역 루프는 API 응답 후 자동 중단
        State.activeMapId = mapId;

        log("MAP" + mapId + " 로드 완료");
        if (Cfg.autoJson) startCurrentMapThenGlobalPretranslate(mapData, mapId);
    };

    //=========================================================================
    // Window_Message 패치
    //
    // 흐름:
    //  [1] startMessage 호출
    //      ├─ 캐시 HIT  → 번역문으로 $gameMessage 교체 후 바로 표시
    //      └─ 캐시 MISS → 원문 보관, 로딩 텍스트 표시 후 API 비동기 호출
    //
    //  [2] API 응답 도착
    //      → $gameMessage 교체 → 현재 창 닫기 → 번역문으로 재시작
    //=========================================================================

    // 내부 상태 플래그
    const MsgState = {
        IDLE:         "IDLE",
        WAIT_API:     "WAIT_API",   // API 응답 대기 중
        SHOW_RESULT:  "SHOW_RESULT" // 번역 결과 표시 준비 완료
    };

    const _initMsg = Window_Message.prototype.initialize;
    Window_Message.prototype.initialize = function(rect) {
        _initMsg.call(this, rect);
        this._lmtState         = MsgState.IDLE;
        this._lmtOriginalText  = "";
        this._lmtCharName      = "";
        this._lmtFaceInfo      = null;
        this._lmtSpeaker       = "";
        this._lmtBackground    = 0;
        this._lmtPosition      = 2;
        this._lmtPendingLines  = [];  // ← 번역 결과 임시 보관 (창 닫히는 동안 유지)
        this._lmtExtraPages    = [];  // ← 2페이지 이후 번역 내용 보관
    };

    const _startMessage = Window_Message.prototype.startMessage;
    Window_Message.prototype.startMessage = function() {

        // ── 번역 비활성화 ──────────────────────────────────
        if (!State.enabled) {
            _startMessage.call(this);
            return;
        }

        // ── SHOW_RESULT: 번역 완료 후 재진입 ──────────────
        // $gameMessage가 엔진에 의해 지워졌을 수 있으므로
        // 인스턴스 변수에 저장해둔 번역 결과로 직접 복원
        if (this._lmtState === MsgState.SHOW_RESULT) {
            this._lmtState = MsgState.IDLE;
            $gameMessage.clear();
            this._restoreMessageMeta();
            this._lmtPendingLines.forEach(function(line) { $gameMessage.add(line); });
            this._lmtPendingLines = [];
            _startMessage.call(this);

            // 2페이지 이후가 남아 있으면 각각 SHOW_RESULT로 순차 표시
            // 엔진의 메시지 큐 대신 _lmtExtraPages를 직접 관리
            if (this._lmtExtraPages && this._lmtExtraPages.length > 0) {
                this._lmtPendingLines = this._lmtExtraPages.shift();
                this._lmtState        = MsgState.SHOW_RESULT;
                // isClosed()를 기다린 후 update()에서 자동 재진입
            }
            return;
        }

        // ── WAIT_API: API 대기 중 중복 호출 무시 ──────────
        if (this._lmtState === MsgState.WAIT_API) return;

        // ── IDLE: 새 메시지 시작 ───────────────────────────
        const { charName, text } = getMessageInfo();

        // 빈 메시지는 그냥 통과
        if (!text.trim()) {
            _startMessage.call(this);
            return;
        }

        const key = makeCacheKey(charName, text);

        // 표시 전 번역이 실패한 직후에는 같은 메시지를 한 번만 원문으로 통과시킨다.
        // 이렇게 해야 LM Studio가 꺼져 있을 때 "표시 전 대기 + 창 안 로딩 대기"가 이중으로 걸리지 않는다.
        if (State.preDisplayFallback.has(key)) {
            State.preDisplayFallback.delete(key);
            _startMessage.call(this);
            return;
        }

        // ── 캐시 HIT: 번역문 즉시 적용 ────────────────────
        if (State.cache.has(key)) {
            log(`캐시 HIT: "${charName}" | "${text.slice(0, 25)}..."`);
            this._applyTranslation(State.cache.get(key), charName);
            _startMessage.call(this);
            prioritizeNextMessages(State.currentInterp, State.currentMessageNextIndex);
            return;
        }

        if (State.attempted.has(key) || State.inflight.has(key)) {
            log("이미 번역 시도/진행 중 - 원문 표시: " + text.slice(0, 30));
            _startMessage.call(this);
            prioritizeNextMessages(State.currentInterp, State.currentMessageNextIndex);
            return;
        }

        // ── 캐시 MISS: API 호출 ────────────────────────────
        log(`번역 요청: "${charName}" | "${text.slice(0, 30)}..."`);

        // 현재 메시지 메타 정보 보관
        this._lmtOriginalText = text;
        this._lmtCharName     = charName;
        this._lmtSpeaker      = charName;
        this._lmtBackground   = $gameMessage.background();
        this._lmtPosition     = $gameMessage.positionType();
        this._lmtFaceInfo     = {
            name:  $gameMessage.faceName(),
            index: $gameMessage.faceIndex()
        };

        this._lmtState = MsgState.WAIT_API;

        // 현재 실제 표시될 메시지가 최우선이다. JSON 선번역은 현재 청크까지만 끝내고 멈춘다.
        State.foreground = true;
        State.jsonJobToken++;
        State.jsonPretranslateStarted = false;
        State.jsonPretranslateRunning = false;
        State.currentMapPretranslateRunning = false;
        if (State.jsonController) {
            State.jsonController.abort();
            State.jsonController = null;
        }
        dropAbortedApiJobs();
        if (State.bgController) {
            State.bgController.abort();
            State.bgController = null;
            State.prefetching.clear();
        }



        // 로딩 텍스트 표시
        // showLoading=false여도 _startMessage를 반드시 호출해야
        // Window_Message.update()의 while 루프가 무한반복(프리징)하지 않음
        $gameMessage.clear();
        this._restoreMessageMeta();
        if (Cfg.showLoading) {
            $gameMessage.add(Cfg.loadingText);
        } else {
            // 빈 창을 띄워 while 루프를 빠져나오게 함 (화면에는 안 보임)
            $gameMessage.add("");
        }
        _startMessage.call(this);

        // 비동기 번역
        var self = this;
        markTranslationStarted(key);
        callAPI(text, charName, null, true).then(function(result) {
            var translated = result ? result.trim() : null;

            // 번역 결과가 없거나 원문과 동일하면 캐시 저장 안 함
            if (markTranslationFinished(key, translated, text)) {
                log("번역 완료 [" + (charName || "?") + "]: " + translated.slice(0, 40));
                saveCacheToFile();
            } else {
                log("번역 실패 또는 원문과 동일 - 재번역 방지, 원문 표시");
                translated = Cfg.fallback ? text : "";
            }

            // splitIntoPages로 maxLines 단위 분할
            // 얼굴 그래픽 유무에 따라 텍스트 너비 자동 조정
            var hasFace = !!(self._lmtFaceInfo && self._lmtFaceInfo.name);
            var pages = splitIntoPages(translated, Cfg.maxLines, hasFace);

            // 첫 페이지를 현재 창에 표시 (SHOW_RESULT 분기에서 꺼내 씀)
            self._lmtPendingLines = pages[0];
            // 2페이지 이후는 _lmtExtraPages에 보관
            // → SHOW_RESULT에서 첫 창이 닫힌 후 순서대로 표시
            self._lmtExtraPages  = pages.slice(1);
            self._lmtState = MsgState.SHOW_RESULT;

            State.foreground = false;
            // 현재 문장 다음에는 바로 다음 메시지들을 먼저 선번역하고, 그 뒤 현재 맵/전체 JSON으로 돌아간다.
            prioritizeNextMessages(State.currentInterp, State.currentMessageNextIndex);

            // 로딩 창 닫기 → update()에서 isClosed() 감지 후 SHOW_RESULT 재진입
            if (self.isOpen() || self.isOpening()) {
                self.close();
            } else {
                self.startMessage();
            }
        });
    };

    /** $gameMessage 메타 정보(얼굴/위치/배경/화자) 복원 */
    Window_Message.prototype._restoreMessageMeta = function() {
        if (this._lmtFaceInfo) {
            $gameMessage.setFaceImage(this._lmtFaceInfo.name, this._lmtFaceInfo.index);
        }
        $gameMessage.setBackground(this._lmtBackground);
        $gameMessage.setPositionType(this._lmtPosition);
        if (this._lmtSpeaker && typeof $gameMessage.setSpeakerName === "function") {
            $gameMessage.setSpeakerName(this._lmtSpeaker);
        }
    };

    /** 번역문을 $gameMessage에 직접 적용 (캐시 HIT용) */
    Window_Message.prototype._applyTranslation = function(translatedText, charName) {
        const faceN  = $gameMessage.faceName();
        const faceI  = $gameMessage.faceIndex();
        const bg     = $gameMessage.background();
        const pos    = $gameMessage.positionType();

        // splitIntoPages로 분할 - 얼굴 유무에 따라 텍스트 너비 자동 조정
        var hasFace = !!(faceN && faceN.length > 0);
        var pages = splitIntoPages(translatedText, Cfg.maxLines, hasFace);

        $gameMessage.clear();
        $gameMessage.setFaceImage(faceN, faceI);
        $gameMessage.setBackground(bg);
        $gameMessage.setPositionType(pos);
        if (charName && typeof $gameMessage.setSpeakerName === "function") {
            $gameMessage.setSpeakerName(charName);
        }
        // 첫 페이지만 $gameMessage에 등록
        pages[0].forEach(function(line) { $gameMessage.add(line); });

        // 2페이지 이후는 _lmtExtraPages에 보관
        // → SHOW_RESULT 분기에서 창이 닫힐 때마다 순차적으로 표시
        // $gameMessage.add로 한꺼번에 추가하면 단일 창에 모두 출력되어 오버플로우 발생
        this._lmtFaceInfo   = { name: faceN, index: faceI };
        this._lmtBackground = bg;
        this._lmtPosition   = pos;
        this._lmtSpeaker    = charName || "";
        this._lmtExtraPages = pages.slice(1);

        if (this._lmtExtraPages.length > 0) {
            this._lmtPendingLines = this._lmtExtraPages.shift();
            this._lmtState        = MsgState.SHOW_RESULT;
        }
    };

    //=========================================================================
    // update: SHOW_RESULT 상태에서 창 닫힌 후 자동 재시작
    //=========================================================================
    const _update = Window_Message.prototype.update;
    Window_Message.prototype.update = function() {
        _update.call(this);

        if (this._lmtState === MsgState.SHOW_RESULT) {
            // 창이 완전히 닫히면 재시작
            if (this.isClosed()) {
                this.startMessage();
            }
        }
    };

    //=========================================================================
    // Game_Interpreter 패치
    // 번역 대기 중(WAIT_API / SHOW_RESULT) 이벤트 진행 차단
    //=========================================================================
    const _setupInterpreter = Game_Interpreter.prototype.setup;
    Game_Interpreter.prototype.setup = function(list, eventId) {
        _setupInterpreter.call(this, list, eventId);
        rememberCurrentInterpreter(this, eventId);
        State.currentMessageNextIndex = 0;
        // 플레이 중 렉 방지를 위해 이벤트 setup 시 자동 선번역은 하지 않는다.
        // 실제 메시지가 표시될 때 현재/다음 메시지만 우선 번역한다.
    };

    function commentCommandsAt(interp) {
        if (!interp || !interp._list) return [];
        var list = interp._list;
        var index = interp._index || 0;
        var result = [];
        var cmd = list[index];
        if (!cmd || cmd.code !== 108) return result;
        result.push({ command: cmd, text: String(cmd.parameters[0] || "") });
        var i = index + 1;
        while (i < list.length && list[i] && list[i].code === 408) {
            result.push({ command: list[i], text: String(list[i].parameters[0] || "") });
            i++;
        }
        return result;
    }

    function applyTranslatedCommentLine(originalLine, translatedText) {
        if (activeMessageInnerText(originalLine)) {
            return replaceActiveMessageInnerText(originalLine, translatedText);
        }
        return translatedText;
    }

    const _cmd108 = Game_Interpreter.prototype.command108;
    Game_Interpreter.prototype.command108 = function(params) {
        if (!State.enabled || !Cfg.translateComments) {
            return _cmd108.call(this, params);
        }

        var entries = commentCommandsAt(this).filter(function(entry) {
            return shouldTranslatePlainText(translatableCommentText(entry.text));
        });
        if (entries.length === 0) return _cmd108.call(this, params);

        var pending = this._lmtCommentTranslate;
        var signature = entries.map(function(entry) { return entry.text; }).join("\n");
        if (pending && pending.signature === signature) {
            if (!pending.done) return false;
            this._lmtCommentTranslate = null;
            return _cmd108.call(this, params);
        }

        var missing = entries.filter(function(entry) {
            var original = translatableCommentText(entry.text);
            return !State.cache.has(makeCacheKey("Comment", original)) && !State.attempted.has(makeCacheKey("Comment", original));
        });
        if (missing.length === 0) {
            entries.forEach(function(entry) {
                var original = translatableCommentText(entry.text);
                var cached = State.cache.get(makeCacheKey("Comment", original));
                if (cached) entry.command.parameters[0] = applyTranslatedCommentLine(entry.text, cached);
            });
            return _cmd108.call(this, params);
        }

        var task = {
            signature: signature,
            done: false
        };
        this._lmtCommentTranslate = task;

        Promise.all(missing.map(function(entry) {
            var original = translatableCommentText(entry.text);
            var key = makeCacheKey("Comment", original);
            markTranslationStarted(key);
            return callAPI(original, "Comment", null, true).then(function(result) {
                markTranslationFinished(key, result ? result.trim() : null, original);
            });
        })).then(function() {
            entries.forEach(function(entry) {
                var original = translatableCommentText(entry.text);
                var cached = State.cache.get(makeCacheKey("Comment", original));
                if (cached) entry.command.parameters[0] = applyTranslatedCommentLine(entry.text, cached);
            });
            saveCacheToFile();
            task.done = true;
        }, function() {
            task.done = true;
        });
        return false;
    };

    const _cmd101 = Game_Interpreter.prototype.command101;
    Game_Interpreter.prototype.command101 = function(params) {
        if ($gameMessage.isBusy()) return false;
        // 현재 인터프리터 참조 저장 → 다음 메시지 미리보기에 사용
        rememberCurrentInterpreter(this);

        if (State.enabled && Cfg.preBeforeShow) {
            var block = readMessageBlockFromInterpreter(this);
            if (block && block.text.trim()) {
                State.currentMessageNextIndex = block.nextIndex;
                var key = makeCacheKey(block.speakerName, block.text);

                if (State.cache.has(key)) {
                    prioritizeNextMessages(this, block.nextIndex);
                }

                if (!State.cache.has(key) && State.prefetching.has(key)) {
                    log("표시 전 번역 대기: 선번역 진행 중 [" + (block.speakerName || "?") + "]");
                    return false;
                }

                if (!State.cache.has(key) && State.attempted.has(key)) {
                    log("표시 전 번역 스킵: 이미 시도한 메시지 [" + (block.speakerName || "?") + "]");
                    return _cmd101.call(this, params);
                }

                if (!State.cache.has(key)) {
                    var pending = this._lmtPretranslate;
                    var samePending = pending &&
                        pending.index === block.index &&
                        pending.key === key;

                    if (samePending) {
                        if (!pending.done) return false;
                        this._lmtPretranslate = null;
                    } else {
                        log("표시 전 번역 요청: \"" + (block.speakerName || "?") + "\" | \"" + block.text.slice(0, 30) + "...\"");

                        var task = {
                            index: block.index,
                            key: key,
                            done: false
                        };
                        this._lmtPretranslate = task;

                        State.foreground = true;
                        State.jsonJobToken++;
                        State.jsonPretranslateStarted = false;
                        State.jsonPretranslateRunning = false;
                        State.currentMapPretranslateRunning = false;
                        if (State.jsonController) {
                            State.jsonController.abort();
                            State.jsonController = null;
                        }
                        dropAbortedApiJobs();
                        if (State.bgController) {
                            State.bgController.abort();
                            State.bgController = null;
                            State.prefetching.clear();
                        }

                        markTranslationStarted(key);
                        callAPI(block.text, block.speakerName, null, true).then(function(result) {
                            var translated = result ? result.trim() : null;

                            if (markTranslationFinished(key, translated, block.text)) {
                                saveCacheToFile();
                                log("표시 전 번역 완료 [" + (block.speakerName || "?") + "]: " + translated.slice(0, 40));
                            } else {
                                State.preDisplayFallback.add(key);
                                log("표시 전 번역 실패 또는 원문과 동일 - 재번역 방지, 이번 메시지는 원문 표시");
                            }
                            task.done = true;
                            State.foreground = false;
                            prioritizeNextMessages(State.currentInterp, block.nextIndex);
                        }, function(e) {
                            markTranslationFinished(key, null, block.text);
                            State.preDisplayFallback.add(key);
                            console.warn("[" + PLUGIN_NAME + "] 표시 전 번역 실패 (" + e.message + ")");
                            task.done = true;
                            State.foreground = false;
                            prioritizeNextMessages(State.currentInterp, block.nextIndex);
                        });

                        return false;
                    }
                }
            }
        }

        return _cmd101.call(this, params);
    };

    // 메시지 창이 번역 대기 중일 때 isTerminated 를 false로 유지
    const _isNumberInputWindowActive = Window_Message.prototype.isAnySubWindowActive;
    Window_Message.prototype.isAnySubWindowActive = function() {
        if (this._lmtState === MsgState.WAIT_API) return true;
        return _isNumberInputWindowActive
            ? _isNumberInputWindowActive.call(this)
            : false;
    };

    //=========================================================================
    // 플러그인 커맨드 (MZ 전용 - MV에서는 무시)
    //=========================================================================
    if (typeof PluginManager.registerCommand === "function") {
        PluginManager.registerCommand(PLUGIN_NAME, "toggleTranslation", function() {
            State.enabled = !State.enabled;
            info("번역 " + (State.enabled ? "ON" : "OFF"));
        });

        PluginManager.registerCommand(PLUGIN_NAME, "clearCache", function() {
            var count = State.cacheMeta.size || State.cache.size;
            State.cache.clear();
            State.cacheMeta.clear();
            State.cacheDirty = false;
            if (State.cacheFlushTimer) {
                clearTimeout(State.cacheFlushTimer);
                State.cacheFlushTimer = null;
            }
            State.attempted.clear();
            State.inflight.clear();
            State.jsonPretranslateStarted = false;
            State.jsonJobToken++;
            State.currentMapPretranslateRunning = false;
            State.jsonPretranslateRunning = false;
            State.currentEventPretranslateRunning = false;
            State.currentEventId = 0;
            State.currentMessageNextIndex = null;
            if (State.jsonController) {
                State.jsonController.abort();
                State.jsonController = null;
            }
            dropAbortedApiJobs();
            // JSON 파일도 초기화
            if (_fs) {
                var filePath = _getCacheFilePath();
                try {
                    _fs.writeFileSync(filePath, "{}", "utf8");
                    _fs.writeFileSync(_getWorkCacheFilePath(), "{}", "utf8");
                } catch (e) {
                    console.warn("[" + PLUGIN_NAME + "] 캐시 파일 초기화 실패:", e.message);
                }
            }
            console.info("[" + PLUGIN_NAME + "] 캐시 " + count + "개 삭제 (파일 포함)");
        });

        PluginManager.registerCommand(PLUGIN_NAME, "setEnabled", function(args) {
            State.enabled = args.enabled === "true" || args.enabled === true;
            info("번역 " + (State.enabled ? "ON" : "OFF"));
        });

        PluginManager.registerCommand(PLUGIN_NAME, "startJsonPretranslate", function() {
            State.jsonPretranslateStarted = false;
            State.currentMapPretranslateRunning = false;
            startJsonPretranslateManual(0);
        });
    }

    if (typeof window !== "undefined" && window.addEventListener) {
        window.addEventListener("beforeunload", function() {
            flushCacheToFile();
        });
    }

    if (Cfg.autoJson) startJsonPretranslate();

    console.info("[" + PLUGIN_NAME + "] v3.14.7 로드 | Comment 번역 " + (Cfg.translateComments ? "ON" : "OFF") + " | 메뉴/DB 번역 " + (Cfg.translateDatabaseText ? "ON" : "OFF") + " | 자동 JSON 선번역 " + (Cfg.autoJson ? "ON" : "OFF"));

})();
