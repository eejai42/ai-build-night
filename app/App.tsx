import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';

// Use your machine's LAN IP (not localhost) so phones on the same Wi-Fi can reach it.
const API = 'http://192.168.1.122:42441';

type Topic = {
  topic_id: string;
  title: string;
  icon: string | null;
  summary: string | null;
  count_of_strategies: number;
};

type Criterion = {
  criterion_id: string;
  title: string;
  icon: string | null;
  description: string | null;
  high_score_meaning: string | null;
  low_score_meaning: string | null;
  sort_order: number | null;
  count_of_scores: number;
  average_score: string | null;
};

type Strategy = {
  strategy_id: string;
  topic: string;
  topic_title: string | null;
  topic_icon: string | null;
  title: string;
  summary: string | null;
  verdict: string | null;
  recommended_for: string | null;
  count_of_pros: number;
  count_of_cons: number;
  average_score: string | null;
};

type Scenario = {
  scenario_id: string;
  strategy: string;
  title: string;
  description: string | null;
};

type Consideration = {
  consideration_id: string;
  strategy: string;
  criterion: string | null;
  criterion_title: string | null;
  is_pro: boolean;
  statement: string;
  kind: string;
};

type StrategyScore = {
  score_id: string;
  strategy: string;
  strategy_title: string | null;
  criterion: string;
  criterion_title: string | null;
  criterion_icon: string | null;
  score: number;
  rationale: string | null;
};

type Tab = 'topics' | 'criteria';

type Screen =
  | { screen: 'topics' }
  | { screen: 'strategies'; topicId: string }
  | { screen: 'strategy'; topicId: string; strategyId: string }
  | { screen: 'criteria' }
  | { screen: 'criterion'; criterionId: string };

// ---- Generic edit-form modal --------------------------------------------

type FieldDef = {
  key: string; // PascalCase write-side field name
  label: string;
  kind: 'text' | 'multiline' | 'boolean' | 'score';
};

type EditModalState = {
  table: string;
  fields: FieldDef[];
  values: Record<string, string | boolean | number>;
  rowId: string | null; // null = creating a new row
};

// 1 = red, 3 = amber, 5 = green
function scoreColor(score: number): string {
  const colors: Record<number, string> = {
    1: '#d32f2f',
    2: '#e65100',
    3: '#f9a825',
    4: '#7cb342',
    5: '#2e7d32',
  };
  return colors[Math.round(score)] ?? '#999';
}

function ScoreBadge({ score, size = 'normal' }: { score: number; size?: 'normal' | 'large' }) {
  const color = scoreColor(score);
  return (
    <View
      style={[
        styles.scoreBadge,
        { backgroundColor: color },
        size === 'large' && styles.scoreBadgeLarge,
      ]}
    >
      <Text style={[styles.scoreBadgeText, size === 'large' && styles.scoreBadgeTextLarge]}>
        {score.toFixed(1)}
      </Text>
    </View>
  );
}

function MiniScoreBars({ scores }: { scores: { criterion_icon: string | null; score: number }[] }) {
  if (scores.length === 0) return null;
  return (
    <View style={styles.miniBarsRow}>
      {scores.map((s, i) => (
        <View key={i} style={styles.miniBarWrap}>
          <View style={[styles.miniBar, { height: 6 + s.score * 4, backgroundColor: scoreColor(s.score) }]} />
        </View>
      ))}
    </View>
  );
}

function ScorePicker({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <View style={styles.scorePickerRow}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Pressable
          key={n}
          style={[styles.scorePickerButton, value === n && styles.scorePickerButtonActive]}
          onPress={() => onChange(n)}
        >
          <Text style={[styles.scorePickerText, value === n && styles.scorePickerTextActive]}>{n}</Text>
        </Pressable>
      ))}
    </View>
  );
}

function EditModal({
  state,
  onClose,
  onSaved,
}: {
  state: EditModalState | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [values, setValues] = useState<Record<string, string | boolean | number>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (state) {
      setValues(state.values);
      setError(null);
    }
  }, [state]);

  if (!state) return null;

  const isNew = state.rowId === null;

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const url = isNew
        ? `${API}/api/tables/${state.table}/rows`
        : `${API}/api/tables/${state.table}/rows/${state.rowId}`;
      const res = await fetch(url, {
        method: isNew ? 'POST' : 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });
      if (!res.ok) {
        const body = await res.text();
        throw new Error(body || `HTTP ${res.status}`);
      }
      onSaved();
      onClose();
    } catch (e) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  };

  const del = async () => {
    if (isNew || !state.rowId) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`${API}/api/tables/${state.table}/rows/${state.rowId}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const body = await res.text();
        throw new Error(body || `HTTP ${res.status}`);
      }
      onSaved();
      onClose();
    } catch (e) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalCard}>
          <ScrollView>
            <Text style={styles.h2}>
              {isNew ? 'Add' : 'Edit'} {state.table.slice(0, -1)}
            </Text>

            {state.fields.map((f) => (
              <View key={f.key} style={styles.formRow}>
                <Text style={styles.formLabel}>{f.label}</Text>
                {f.kind === 'boolean' ? (
                  <Switch
                    value={Boolean(values[f.key])}
                    onValueChange={(v) => setValues((prev) => ({ ...prev, [f.key]: v }))}
                  />
                ) : f.kind === 'score' ? (
                  <ScorePicker
                    value={Number(values[f.key] ?? 3)}
                    onChange={(v) => setValues((prev) => ({ ...prev, [f.key]: v }))}
                  />
                ) : (
                  <TextInput
                    style={[styles.input, f.kind === 'multiline' && styles.inputMultiline]}
                    multiline={f.kind === 'multiline'}
                    value={String(values[f.key] ?? '')}
                    onChangeText={(t) => setValues((prev) => ({ ...prev, [f.key]: t }))}
                  />
                )}
              </View>
            ))}

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <View style={styles.modalButtonRow}>
              <Pressable style={styles.button} onPress={save} disabled={saving}>
                <Text style={styles.buttonText}>{saving ? 'Saving…' : 'Save'}</Text>
              </Pressable>
              {!isNew && (
                <Pressable style={[styles.button, styles.dangerButton]} onPress={del} disabled={saving}>
                  <Text style={styles.buttonText}>Delete</Text>
                </Pressable>
              )}
              <Pressable style={[styles.button, styles.secondaryButton]} onPress={onClose} disabled={saving}>
                <Text style={styles.secondaryButtonText}>Cancel</Text>
              </Pressable>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function EditPencil({ onPress }: { onPress: () => void }) {
  return (
    <Pressable hitSlop={10} onPress={onPress}>
      <Text style={styles.pencil}>✏️</Text>
    </Pressable>
  );
}

function AddButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable style={styles.addButtonSmall} onPress={onPress}>
      <Text style={styles.addButtonText}>{label}</Text>
    </Pressable>
  );
}

// ---- Main app -------------------------------------------------------------

export default function App() {
  const [topics, setTopics] = useState<Topic[]>([]);
  const [criteria, setCriteria] = useState<Criterion[]>([]);
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [considerations, setConsiderations] = useState<Consideration[]>([]);
  const [scores, setScores] = useState<StrategyScore[]>([]);
  const [tab, setTab] = useState<Tab>('topics');
  const [view, setView] = useState<Screen>({ screen: 'topics' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editState, setEditState] = useState<EditModalState | null>(null);

  const reload = useCallback(() => {
    setLoading(true);
    return Promise.all([
      fetch(`${API}/api/tables/Topics`).then((r) => r.json()),
      fetch(`${API}/api/tables/Criteria`).then((r) => r.json()),
      fetch(`${API}/api/tables/Strategies`).then((r) => r.json()),
      fetch(`${API}/api/tables/Scenarios`).then((r) => r.json()),
      fetch(`${API}/api/tables/Considerations`).then((r) => r.json()),
      fetch(`${API}/api/tables/StrategyScores`).then((r) => r.json()),
    ])
      .then(([t, cr, s, sc, co, sco]) => {
        setTopics(t.rows);
        setCriteria(cr.rows.sort((a: Criterion, b: Criterion) => (a.sort_order ?? 0) - (b.sort_order ?? 0)));
        setStrategies(s.rows);
        setScenarios(sc.rows);
        setConsiderations(co.rows);
        setScores(sco.rows);
        setError(null);
      })
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const switchTab = (t: Tab) => {
    setTab(t);
    setView(t === 'topics' ? { screen: 'topics' } : { screen: 'criteria' });
  };

  if (loading && topics.length === 0 && !error) {
    return (
      <SafeAreaView style={styles.centered}>
        <ActivityIndicator size="large" />
        <StatusBar style="auto" />
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.centered}>
        <Text style={styles.error}>Failed to reach API: {error}</Text>
        <StatusBar style="auto" />
      </SafeAreaView>
    );
  }

  const strategyScoreMap = (strategyId: string) => scores.filter((s) => s.strategy === strategyId);

  // ---- Screens ----

  let body: React.ReactNode = null;

  if (view.screen === 'topics') {
    body = (
      <FlatList
        data={topics}
        keyExtractor={(item) => item.topic_id}
        contentContainerStyle={styles.padded}
        ListHeaderComponent={
          <View style={styles.headerRow}>
            <Text style={styles.h1}>Topics</Text>
            <AddButton
              label="+ Add Topic"
              onPress={() =>
                setEditState({
                  table: 'Topics',
                  rowId: null,
                  fields: [
                    { key: 'TopicId', label: 'Topic Id (slug)', kind: 'text' },
                    { key: 'Title', label: 'Title', kind: 'text' },
                    { key: 'Icon', label: 'Icon (single emoji)', kind: 'text' },
                    { key: 'Summary', label: 'Summary', kind: 'multiline' },
                  ],
                  values: { TopicId: '', Title: '', Icon: '', Summary: '' },
                })
              }
            />
          </View>
        }
        renderItem={({ item }) => (
          <Pressable style={styles.card} onPress={() => setView({ screen: 'strategies', topicId: item.topic_id })}>
            <View style={styles.cardHeaderRow}>
              <Text style={styles.cardTitle}>
                {item.icon ? `${item.icon} ` : ''}
                {item.title}
              </Text>
              <EditPencil
                onPress={() =>
                  setEditState({
                    table: 'Topics',
                    rowId: item.topic_id,
                    fields: [
                      { key: 'Title', label: 'Title', kind: 'text' },
                      { key: 'Icon', label: 'Icon (single emoji)', kind: 'text' },
                      { key: 'Summary', label: 'Summary', kind: 'multiline' },
                    ],
                    values: { Title: item.title, Icon: item.icon ?? '', Summary: item.summary ?? '' },
                  })
                }
              />
            </View>
            {item.summary ? <Text style={styles.cardBody}>{item.summary}</Text> : null}
            <Text style={styles.counts}>{item.count_of_strategies} strategies</Text>
          </Pressable>
        )}
      />
    );
  } else if (view.screen === 'strategies') {
    const topic = topics.find((t) => t.topic_id === view.topicId);
    const topicStrategies = strategies.filter((s) => s.topic === view.topicId);

    body = (
      <FlatList
        data={topicStrategies}
        keyExtractor={(item) => item.strategy_id}
        contentContainerStyle={styles.padded}
        ListHeaderComponent={
          <View>
            <Pressable onPress={() => setView({ screen: 'topics' })}>
              <Text style={styles.backLink}>‹ All Topics</Text>
            </Pressable>
            <View style={styles.headerRow}>
              <Text style={styles.h1}>
                {topic?.icon ? `${topic.icon} ` : ''}
                {topic?.title ?? view.topicId}
              </Text>
              <AddButton
                label="+ Add Strategy"
                onPress={() =>
                  setEditState({
                    table: 'Strategies',
                    rowId: null,
                    fields: [
                      { key: 'StrategyId', label: 'Strategy Id (slug)', kind: 'text' },
                      { key: 'Topic', label: 'Topic Id', kind: 'text' },
                      { key: 'Title', label: 'Title', kind: 'text' },
                      { key: 'Summary', label: 'Summary', kind: 'multiline' },
                      { key: 'Verdict', label: 'Verdict', kind: 'multiline' },
                      { key: 'RecommendedFor', label: 'Recommended For', kind: 'text' },
                    ],
                    values: {
                      StrategyId: '',
                      Topic: view.topicId,
                      Title: '',
                      Summary: '',
                      Verdict: '',
                      RecommendedFor: '',
                    },
                  })
                }
              />
            </View>
          </View>
        }
        renderItem={({ item }) => {
          const itemScores = strategyScoreMap(item.strategy_id);
          return (
            <Pressable
              style={styles.strategyCard}
              onPress={() => setView({ screen: 'strategy', topicId: view.topicId, strategyId: item.strategy_id })}
            >
              <View style={styles.cardHeaderRow}>
                <Text style={styles.cardTitle}>{item.title}</Text>
                {item.average_score ? <ScoreBadge score={Number(item.average_score)} /> : null}
                <EditPencil
                  onPress={() =>
                    setEditState({
                      table: 'Strategies',
                      rowId: item.strategy_id,
                      fields: [
                        { key: 'Title', label: 'Title', kind: 'text' },
                        { key: 'Summary', label: 'Summary', kind: 'multiline' },
                        { key: 'Verdict', label: 'Verdict', kind: 'multiline' },
                        { key: 'RecommendedFor', label: 'Recommended For', kind: 'text' },
                      ],
                      values: {
                        Title: item.title,
                        Summary: item.summary ?? '',
                        Verdict: item.verdict ?? '',
                        RecommendedFor: item.recommended_for ?? '',
                      },
                    })
                  }
                />
              </View>
              {item.summary ? <Text style={styles.cardBody}>{item.summary}</Text> : null}
              <MiniScoreBars scores={itemScores} />
              <Text style={styles.counts}>
                <Text style={styles.proText}>{item.count_of_pros} pro</Text>
                {'  ·  '}
                <Text style={styles.conText}>{item.count_of_cons} con</Text>
              </Text>
            </Pressable>
          );
        }}
      />
    );
  } else if (view.screen === 'strategy') {
    const strategy = strategies.find((s) => s.strategy_id === view.strategyId);
    const strategyScenarios = scenarios.filter((s) => s.strategy === view.strategyId);
    const strategyConsiderations = considerations.filter((c) => c.strategy === view.strategyId);
    const strategyScores = strategyScoreMap(view.strategyId);
    const pros = strategyConsiderations.filter((c) => c.is_pro);
    const cons = strategyConsiderations.filter((c) => !c.is_pro);
    const scoredCriterionIds = new Set(strategyScores.map((s) => s.criterion));
    const unscoredCriteria = criteria.filter((c) => !scoredCriterionIds.has(c.criterion_id));

    body = (
      <FlatList
        data={[]}
        renderItem={null}
        ListHeaderComponent={
          <View style={styles.padded}>
            <Pressable onPress={() => setView({ screen: 'strategies', topicId: view.topicId })}>
              <Text style={styles.backLink}>
                ‹ {topics.find((t) => t.topic_id === view.topicId)?.title ?? 'Strategies'}
              </Text>
            </Pressable>

            <Text style={styles.h1}>{strategy?.title ?? view.strategyId}</Text>
            {strategy?.summary ? <Text style={styles.summary}>{strategy.summary}</Text> : null}

            <View style={styles.headerRow}>
              <Text style={styles.h2}>Scores</Text>
              {unscoredCriteria.length > 0 && (
                <AddButton
                  label="+ Score"
                  onPress={() =>
                    setEditState({
                      table: 'StrategyScores',
                      rowId: null,
                      fields: [
                        {
                          key: 'ScoreId',
                          label: 'Score Id (slug, e.g. strategy__criterion)',
                          kind: 'text',
                        },
                        { key: 'Strategy', label: 'Strategy Id', kind: 'text' },
                        { key: 'Criterion', label: 'Criterion Id', kind: 'text' },
                        { key: 'Score', label: 'Score (1-5)', kind: 'score' },
                        { key: 'Rationale', label: 'Rationale', kind: 'multiline' },
                      ],
                      values: {
                        ScoreId: '',
                        Strategy: view.strategyId,
                        Criterion: unscoredCriteria[0].criterion_id,
                        Score: 3,
                        Rationale: '',
                      },
                    })
                  }
                />
              )}
            </View>
            {strategyScores.map((sc) => (
              <View key={sc.score_id} style={styles.card}>
                <View style={styles.cardHeaderRow}>
                  <Text style={styles.cardTitle}>
                    {sc.criterion_icon ? `${sc.criterion_icon} ` : ''}
                    {sc.criterion_title ?? sc.criterion} — {sc.score}/5
                  </Text>
                  <EditPencil
                    onPress={() =>
                      setEditState({
                        table: 'StrategyScores',
                        rowId: sc.score_id,
                        fields: [
                          { key: 'Score', label: 'Score (1-5)', kind: 'score' },
                          { key: 'Rationale', label: 'Rationale', kind: 'multiline' },
                        ],
                        values: { Score: sc.score, Rationale: sc.rationale ?? '' },
                      })
                    }
                  />
                </View>
                {sc.rationale ? <Text style={styles.cardBody}>{sc.rationale}</Text> : null}
              </View>
            ))}

            <View style={styles.headerRow}>
              <Text style={styles.h2}>Scenarios</Text>
              <AddButton
                label="+ Add"
                onPress={() =>
                  setEditState({
                    table: 'Scenarios',
                    rowId: null,
                    fields: [
                      { key: 'ScenarioId', label: 'Scenario Id (slug)', kind: 'text' },
                      { key: 'Strategy', label: 'Strategy Id', kind: 'text' },
                      { key: 'Title', label: 'Title', kind: 'text' },
                      { key: 'Description', label: 'Description', kind: 'multiline' },
                    ],
                    values: { ScenarioId: '', Strategy: view.strategyId, Title: '', Description: '' },
                  })
                }
              />
            </View>
            {strategyScenarios.map((s) => (
              <View key={s.scenario_id} style={styles.card}>
                <View style={styles.cardHeaderRow}>
                  <Text style={styles.cardTitle}>{s.title}</Text>
                  <EditPencil
                    onPress={() =>
                      setEditState({
                        table: 'Scenarios',
                        rowId: s.scenario_id,
                        fields: [
                          { key: 'Title', label: 'Title', kind: 'text' },
                          { key: 'Description', label: 'Description', kind: 'multiline' },
                        ],
                        values: { Title: s.title, Description: s.description ?? '' },
                      })
                    }
                  />
                </View>
                {s.description ? <Text style={styles.cardBody}>{s.description}</Text> : null}
              </View>
            ))}

            <View style={styles.headerRow}>
              <Text style={styles.h2}>Pros ({pros.length})</Text>
              <AddButton
                label="+ Add"
                onPress={() =>
                  setEditState({
                    table: 'Considerations',
                    rowId: null,
                    fields: [
                      { key: 'ConsiderationId', label: 'Consideration Id (slug)', kind: 'text' },
                      { key: 'Strategy', label: 'Strategy Id', kind: 'text' },
                      { key: 'Criterion', label: 'Criterion Id (optional)', kind: 'text' },
                      { key: 'Statement', label: 'Statement', kind: 'multiline' },
                      { key: 'IsPro', label: 'Is Pro', kind: 'boolean' },
                    ],
                    values: {
                      ConsiderationId: '',
                      Strategy: view.strategyId,
                      Criterion: '',
                      Statement: '',
                      IsPro: true,
                    },
                  })
                }
              />
            </View>
            {pros.map((c) => (
              <View key={c.consideration_id} style={[styles.card, styles.proCard]}>
                <View style={styles.cardHeaderRow}>
                  <Text style={styles.cardBody}>{c.statement}</Text>
                  <EditPencil
                    onPress={() =>
                      setEditState({
                        table: 'Considerations',
                        rowId: c.consideration_id,
                        fields: [
                          { key: 'Statement', label: 'Statement', kind: 'multiline' },
                          { key: 'Criterion', label: 'Criterion Id (optional)', kind: 'text' },
                          { key: 'IsPro', label: 'Is Pro', kind: 'boolean' },
                        ],
                        values: { Statement: c.statement, Criterion: c.criterion ?? '', IsPro: c.is_pro },
                      })
                    }
                  />
                </View>
                {c.criterion_title ? <Text style={styles.tag}>{c.criterion_title}</Text> : null}
              </View>
            ))}

            <View style={styles.headerRow}>
              <Text style={styles.h2}>Cons ({cons.length})</Text>
              <AddButton
                label="+ Add"
                onPress={() =>
                  setEditState({
                    table: 'Considerations',
                    rowId: null,
                    fields: [
                      { key: 'ConsiderationId', label: 'Consideration Id (slug)', kind: 'text' },
                      { key: 'Strategy', label: 'Strategy Id', kind: 'text' },
                      { key: 'Criterion', label: 'Criterion Id (optional)', kind: 'text' },
                      { key: 'Statement', label: 'Statement', kind: 'multiline' },
                      { key: 'IsPro', label: 'Is Pro', kind: 'boolean' },
                    ],
                    values: {
                      ConsiderationId: '',
                      Strategy: view.strategyId,
                      Criterion: '',
                      Statement: '',
                      IsPro: false,
                    },
                  })
                }
              />
            </View>
            {cons.map((c) => (
              <View key={c.consideration_id} style={[styles.card, styles.conCard]}>
                <View style={styles.cardHeaderRow}>
                  <Text style={styles.cardBody}>{c.statement}</Text>
                  <EditPencil
                    onPress={() =>
                      setEditState({
                        table: 'Considerations',
                        rowId: c.consideration_id,
                        fields: [
                          { key: 'Statement', label: 'Statement', kind: 'multiline' },
                          { key: 'Criterion', label: 'Criterion Id (optional)', kind: 'text' },
                          { key: 'IsPro', label: 'Is Pro', kind: 'boolean' },
                        ],
                        values: { Statement: c.statement, Criterion: c.criterion ?? '', IsPro: c.is_pro },
                      })
                    }
                  />
                </View>
                {c.criterion_title ? <Text style={styles.tag}>{c.criterion_title}</Text> : null}
              </View>
            ))}
          </View>
        }
      />
    );
  } else if (view.screen === 'criteria') {
    body = (
      <FlatList
        data={criteria}
        keyExtractor={(item) => item.criterion_id}
        contentContainerStyle={styles.padded}
        ListHeaderComponent={
          <View style={styles.headerRow}>
            <Text style={styles.h1}>Criteria</Text>
            <AddButton
              label="+ Add Criterion"
              onPress={() =>
                setEditState({
                  table: 'Criteria',
                  rowId: null,
                  fields: [
                    { key: 'CriterionId', label: 'Criterion Id (slug)', kind: 'text' },
                    { key: 'Title', label: 'Title', kind: 'text' },
                    { key: 'Icon', label: 'Icon (single emoji)', kind: 'text' },
                    { key: 'Description', label: 'Description', kind: 'multiline' },
                    { key: 'HighScoreMeaning', label: 'What a 5 means', kind: 'text' },
                    { key: 'LowScoreMeaning', label: 'What a 1 means', kind: 'text' },
                    { key: 'SortOrder', label: 'Sort Order', kind: 'text' },
                  ],
                  values: {
                    CriterionId: '',
                    Title: '',
                    Icon: '',
                    Description: '',
                    HighScoreMeaning: '',
                    LowScoreMeaning: '',
                    SortOrder: (criteria.length + 1) * 10,
                  },
                })
              }
            />
          </View>
        }
        renderItem={({ item }) => (
          <Pressable style={styles.card} onPress={() => setView({ screen: 'criterion', criterionId: item.criterion_id })}>
            <View style={styles.cardHeaderRow}>
              <Text style={styles.cardTitle}>
                {item.icon ? `${item.icon} ` : ''}
                {item.title}
              </Text>
              <EditPencil
                onPress={() =>
                  setEditState({
                    table: 'Criteria',
                    rowId: item.criterion_id,
                    fields: [
                      { key: 'Title', label: 'Title', kind: 'text' },
                      { key: 'Icon', label: 'Icon (single emoji)', kind: 'text' },
                      { key: 'Description', label: 'Description', kind: 'multiline' },
                      { key: 'HighScoreMeaning', label: 'What a 5 means', kind: 'text' },
                      { key: 'LowScoreMeaning', label: 'What a 1 means', kind: 'text' },
                    ],
                    values: {
                      Title: item.title,
                      Icon: item.icon ?? '',
                      Description: item.description ?? '',
                      HighScoreMeaning: item.high_score_meaning ?? '',
                      LowScoreMeaning: item.low_score_meaning ?? '',
                    },
                  })
                }
              />
            </View>
            {item.description ? <Text style={styles.cardBody}>{item.description}</Text> : null}
            <Text style={styles.counts}>
              {item.count_of_scores} strategies scored
              {item.average_score ? ` · avg ${Number(item.average_score).toFixed(1)}` : ''}
            </Text>
          </Pressable>
        )}
      />
    );
  } else if (view.screen === 'criterion') {
    const criterion = criteria.find((c) => c.criterion_id === view.criterionId);
    const criterionScores = scores
      .filter((s) => s.criterion === view.criterionId)
      .slice()
      .sort((a, b) => b.score - a.score);

    body = (
      <FlatList
        data={criterionScores}
        keyExtractor={(item) => item.score_id}
        contentContainerStyle={styles.padded}
        ListHeaderComponent={
          <View>
            <Pressable onPress={() => setView({ screen: 'criteria' })}>
              <Text style={styles.backLink}>‹ All Criteria</Text>
            </Pressable>
            <Text style={styles.h1}>
              {criterion?.icon ? `${criterion.icon} ` : ''}
              {criterion?.title ?? view.criterionId}
            </Text>
            {criterion?.description ? <Text style={styles.summary}>{criterion.description}</Text> : null}
            {criterion?.high_score_meaning ? (
              <Text style={styles.scoreMeaning}>5 = {criterion.high_score_meaning}</Text>
            ) : null}
            {criterion?.low_score_meaning ? (
              <Text style={styles.scoreMeaning}>1 = {criterion.low_score_meaning}</Text>
            ) : null}
            <Text style={[styles.h2, { marginTop: 20 }]}>Strategies, ranked</Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.cardHeaderRow}>
              <Text style={styles.cardTitle}>
                {item.strategy_title ?? item.strategy} — {item.score}/5
              </Text>
              <EditPencil
                onPress={() =>
                  setEditState({
                    table: 'StrategyScores',
                    rowId: item.score_id,
                    fields: [
                      { key: 'Score', label: 'Score (1-5)', kind: 'score' },
                      { key: 'Rationale', label: 'Rationale', kind: 'multiline' },
                    ],
                    values: { Score: item.score, Rationale: item.rationale ?? '' },
                  })
                }
              />
            </View>
            {item.rationale ? <Text style={styles.cardBody}>{item.rationale}</Text> : null}
          </View>
        )}
      />
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.body}>{body}</View>
      <EditModal state={editState} onClose={() => setEditState(null)} onSaved={reload} />
      <View style={styles.tabBar}>
        <Pressable style={styles.tabButton} onPress={() => switchTab('topics')}>
          <Text style={[styles.tabLabel, tab === 'topics' && styles.tabLabelActive]}>📚 Topics</Text>
        </Pressable>
        <Pressable style={styles.tabButton} onPress={() => switchTab('criteria')}>
          <Text style={[styles.tabLabel, tab === 'criteria' && styles.tabLabelActive]}>📊 Criteria</Text>
        </Pressable>
      </View>
      <StatusBar style="auto" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  body: {
    flex: 1,
  },
  centered: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  padded: {
    padding: 16,
  },
  error: {
    color: '#b00020',
    paddingHorizontal: 24,
    textAlign: 'center',
  },
  backLink: {
    color: '#3366cc',
    fontSize: 16,
    marginBottom: 12,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
    marginBottom: 8,
  },
  h1: {
    fontSize: 22,
    fontWeight: '700',
    flexShrink: 1,
  },
  h2: {
    fontSize: 18,
    fontWeight: '600',
  },
  summary: {
    fontSize: 15,
    color: '#444',
    marginBottom: 8,
  },
  scoreMeaning: {
    fontSize: 13,
    color: '#666',
  },
  tag: {
    marginTop: 6,
    fontSize: 12,
    color: '#3366cc',
    fontWeight: '600',
  },
  card: {
    backgroundColor: '#f5f5f7',
    borderRadius: 10,
    padding: 14,
    marginBottom: 10,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  proCard: {
    backgroundColor: '#eaf7ec',
  },
  conCard: {
    backgroundColor: '#fbeaea',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
    flexShrink: 1,
  },
  cardBody: {
    fontSize: 14,
    color: '#333',
    flexShrink: 1,
  },
  counts: {
    marginTop: 6,
    fontSize: 12,
    color: '#777',
  },
  pencil: {
    fontSize: 16,
    marginLeft: 8,
  },
  addButtonSmall: {
    backgroundColor: '#3366cc',
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  addButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 13,
  },
  tabBar: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#eee',
    backgroundColor: '#fff',
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
  },
  tabLabel: {
    fontSize: 14,
    color: '#999',
    fontWeight: '600',
  },
  tabLabelActive: {
    color: '#3366cc',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 20,
    maxHeight: '85%',
  },
  formRow: {
    marginBottom: 14,
  },
  formLabel: {
    fontSize: 13,
    color: '#555',
    marginBottom: 4,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 10,
    fontSize: 15,
  },
  inputMultiline: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  scorePickerRow: {
    flexDirection: 'row',
    gap: 8,
  },
  scorePickerButton: {
    width: 44,
    height: 44,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scorePickerButtonActive: {
    backgroundColor: '#3366cc',
    borderColor: '#3366cc',
  },
  scorePickerText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  scorePickerTextActive: {
    color: '#fff',
  },
  modalButtonRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
    marginBottom: 20,
  },
  button: {
    backgroundColor: '#3366cc',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  dangerButton: {
    backgroundColor: '#b00020',
  },
  secondaryButton: {
    backgroundColor: '#eee',
  },
  buttonText: {
    color: '#fff',
    fontWeight: '600',
  },
  secondaryButtonText: {
    color: '#333',
    fontWeight: '600',
  },
});
