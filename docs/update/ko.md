# Commit Copilot 업데이트 정보

## 버전 1.20.0의 새로운 기능

- 지원되지 않는 Schema 키워드로 인해 OpenAI 엔드포인트 도구 호출이 실패하던 문제를 수정하고, 함수 호출 및 Responses API의 도구 매개변수 Schema를 올바르게 정리하도록 개선했습니다.
- 커밋 메시지와 도구 호출이 정상적으로 반환되도록 Agent 및 Direct Diff 요청에서 Ollama thinking(생각) 모드를 비활성화했습니다。
- Google Gemini 도구 호출이 실패하던 문제를 수정하고, 함수 선언 매개변수를 원시 JSON Schema 필드로 올바르게 전달하도록 개선했습니다。
- Google Gemini 제공자의 Gemini 3.8 Flash 지원을 추가하고 Google 기본 모델을 Gemini 3.8 Flash로 업그레이드했습니다。
- OpenAI 제공자의 GPT-6 Astra 지원을 추가했습니다。
- Anthropic Claude 제공자의 Claude Fable 5.1 지원을 추가했습니다。
- DeepSeek 모델 카탈로그를 업데이트하여 DeepSeek V4.1 Flash를 추가하고 더 이상 사용되지 않는 모델을 정리했습니다。
- OpenAI 제공자의 GPT-6 Luna, GPT-6 Sol, GPT-6.1 Sol 지원을 추가하고 OpenAI 기본 모델을 GPT-6.1 Sol로 업그레이드했습니다.
- Anthropic Claude 제공자의 Claude Opus 5.5 지원을 추가했습니다.
- xAI Grok 제공자의 Grok 4.7 지원을 추가했습니다.
- Groq 모델 카탈로그를 업데이트하여 Qwen 3.8 27b를 추가하고 더 이상 사용되지 않는 모델을 정리했습니다。
