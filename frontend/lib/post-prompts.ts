export const POST_PROMPTS = [
  { id: "feedback", label: "Get fresh ears", description: "Ask a specific question about your playing.", category: "QUESTION", title: "Looking for feedback on my playing", body: "What I am working on:\n\nWhat I have tried:\n\nThe part I would like feedback on (add a timestamp if useful):\n\n#practice" },
  { id: "collaboration", label: "Make something together", description: "Find a musician for your next idea.", category: "DISCUSSION", title: "Looking for a collaborator", body: "The music I want to make:\n\nWhat I play and can contribute:\n\nWho I am looking for:\n\nRemote or local, and a realistic time commitment:\n\n#collaboration" },
  { id: "progress", label: "Share a small win", description: "Tell the story of a musical breakthrough.", category: "DISCUSSION", title: "A small practice breakthrough", body: "The thing that finally clicked:\n\nWhat helped me get there:\n\nWhat I am trying next:\n\n#practice" },
] as const;

export function postPrompt(id: string | undefined) {
  return POST_PROMPTS.find((p) => p.id === id);
}
