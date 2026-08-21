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
  summary: string | null;
  count_of_strategies: number;
};

type Strategy = {
  strategy_id: string;
  topic: string;
  title: string;
  summary: string | null;
  count_of_pros: number;
  count_of_cons: number;
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
  is_pro: boolean;
  statement: string;
  kind: string;
};

type Screen =
  | { screen: 'topics' }
  | { screen: 'strategies'; topicId: string }
  | { screen: 'strategy'; topicId: string; strategyId: string };

// ---- Generic edit-form modal --------------------------------------------

type FieldDef = {
  key: string; // PascalCase write-side field name
  label: string;
  kind: 'text' | 'multiline' | 'boolean';
};

type EditModalState = {
  table: string;
  fields: FieldDef[];
  values: Record<string, string | boolean>;
  rowId: string | null; // null = creating a new row
  idField: string; // write-side name of the stored id field, only used on create
};

function EditModal({
  state,
  onClose,
  onSaved,
}: {
  state: EditModalState | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [values, setValues] = useState<Record<string, string | boolean>>({});
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
            <Text style={styles.h2}>{isNew ? 'Add' : 'Edit'} {state.table.slice(0, -1)}</Text>

            {state.fields.map((f) => (
              <View key={f.key} style={styles.formRow}>
                <Text style={styles.formLabel}>{f.label}</Text>
                {f.kind === 'boolean' ? (
                  <Switch
                    value={Boolean(values[f.key])}
                    onValueChange={(v) => setValues((prev) => ({ ...prev, [f.key]: v }))}
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

// ---- Main app -------------------------------------------------------------

export default function App() {
  const [topics, setTopics] = useState<Topic[]>([]);
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [considerations, setConsiderations] = useState<Consideration[]>([]);
  const [view, setView] = useState<Screen>({ screen: 'topics' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editState, setEditState] = useState<EditModalState | null>(null);

  const reload = useCallback(() => {
    setLoading(true);
    return Promise.all([
      fetch(`${API}/api/tables/Topics`).then((r) => r.json()),
      fetch(`${API}/api/tables/Strategies`).then((r) => r.json()),
      fetch(`${API}/api/tables/Scenarios`).then((r) => r.json()),
      fetch(`${API}/api/tables/Considerations`).then((r) => r.json()),
    ])
      .then(([t, s, sc, c]) => {
        setTopics(t.rows);
        setStrategies(s.rows);
        setScenarios(sc.rows);
        setConsiderations(c.rows);
        setError(null);
      })
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

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

  // ---- Topics list ----
  if (view.screen === 'topics') {
    return (
      <SafeAreaView style={styles.container}>
        <FlatList
          data={topics}
          keyExtractor={(item) => item.topic_id}
          contentContainerStyle={styles.padded}
          ListHeaderComponent={
            <View style={styles.headerRow}>
              <Text style={styles.h1}>AI in Education — Topics</Text>
              <Pressable
                style={styles.addButton}
                onPress={() =>
                  setEditState({
                    table: 'Topics',
                    rowId: null,
                    idField: 'TopicId',
                    fields: [
                      { key: 'TopicId', label: 'Topic Id (slug)', kind: 'text' },
                      { key: 'Title', label: 'Title', kind: 'text' },
                      { key: 'Summary', label: 'Summary', kind: 'multiline' },
                    ],
                    values: { TopicId: '', Title: '', Summary: '' },
                  })
                }
              >
                <Text style={styles.addButtonText}>+ Add Topic</Text>
              </Pressable>
            </View>
          }
          renderItem={({ item }) => (
            <Pressable
              style={styles.card}
              onPress={() => setView({ screen: 'strategies', topicId: item.topic_id })}
            >
              <View style={styles.cardHeaderRow}>
                <Text style={styles.cardTitle}>{item.title}</Text>
                <Pressable
                  hitSlop={10}
                  onPress={() =>
                    setEditState({
                      table: 'Topics',
                      rowId: item.topic_id,
                      idField: 'TopicId',
                      fields: [
                        { key: 'Title', label: 'Title', kind: 'text' },
                        { key: 'Summary', label: 'Summary', kind: 'multiline' },
                      ],
                      values: { Title: item.title, Summary: item.summary ?? '' },
                    })
                  }
                >
                  <Text style={styles.pencil}>✏️</Text>
                </Pressable>
              </View>
              {item.summary ? <Text style={styles.cardBody}>{item.summary}</Text> : null}
              <Text style={styles.counts}>{item.count_of_strategies} strategies</Text>
            </Pressable>
          )}
        />
        <EditModal state={editState} onClose={() => setEditState(null)} onSaved={reload} />
        <StatusBar style="auto" />
      </SafeAreaView>
    );
  }

  // ---- Strategies list (within a topic) ----
  if (view.screen === 'strategies') {
    const topic = topics.find((t) => t.topic_id === view.topicId);
    const topicStrategies = strategies.filter((s) => s.topic === view.topicId);

    return (
      <SafeAreaView style={styles.container}>
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
                <Text style={styles.h1}>{topic?.title ?? view.topicId}</Text>
                <Pressable
                  style={styles.addButton}
                  onPress={() =>
                    setEditState({
                      table: 'Strategies',
                      rowId: null,
                      idField: 'StrategyId',
                      fields: [
                        { key: 'StrategyId', label: 'Strategy Id (slug)', kind: 'text' },
                        { key: 'Topic', label: 'Topic Id', kind: 'text' },
                        { key: 'Title', label: 'Title', kind: 'text' },
                        { key: 'Summary', label: 'Summary', kind: 'multiline' },
                      ],
                      values: { StrategyId: '', Topic: view.topicId, Title: '', Summary: '' },
                    })
                  }
                >
                  <Text style={styles.addButtonText}>+ Add Strategy</Text>
                </Pressable>
              </View>
            </View>
          }
          renderItem={({ item }) => (
            <Pressable
              style={styles.card}
              onPress={() =>
                setView({ screen: 'strategy', topicId: view.topicId, strategyId: item.strategy_id })
              }
            >
              <View style={styles.cardHeaderRow}>
                <Text style={styles.cardTitle}>{item.title}</Text>
                <Pressable
                  hitSlop={10}
                  onPress={() =>
                    setEditState({
                      table: 'Strategies',
                      rowId: item.strategy_id,
                      idField: 'StrategyId',
                      fields: [
                        { key: 'Title', label: 'Title', kind: 'text' },
                        { key: 'Summary', label: 'Summary', kind: 'multiline' },
                      ],
                      values: { Title: item.title, Summary: item.summary ?? '' },
                    })
                  }
                >
                  <Text style={styles.pencil}>✏️</Text>
                </Pressable>
              </View>
              {item.summary ? <Text style={styles.cardBody}>{item.summary}</Text> : null}
              <Text style={styles.counts}>
                {item.count_of_pros} pro · {item.count_of_cons} con
              </Text>
            </Pressable>
          )}
        />
        <EditModal state={editState} onClose={() => setEditState(null)} onSaved={reload} />
        <StatusBar style="auto" />
      </SafeAreaView>
    );
  }

  // ---- Strategy detail (Scenarios + Considerations) ----
  const strategy = strategies.find((s) => s.strategy_id === view.strategyId);
  const strategyScenarios = scenarios.filter((s) => s.strategy === view.strategyId);
  const strategyConsiderations = considerations.filter((c) => c.strategy === view.strategyId);
  const pros = strategyConsiderations.filter((c) => c.is_pro);
  const cons = strategyConsiderations.filter((c) => !c.is_pro);

  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        data={[]}
        renderItem={null}
        ListHeaderComponent={
          <View style={styles.padded}>
            <Pressable onPress={() => setView({ screen: 'strategies', topicId: view.topicId })}>
              <Text style={styles.backLink}>‹ {topics.find((t) => t.topic_id === view.topicId)?.title ?? 'Strategies'}</Text>
            </Pressable>

            <Text style={styles.h1}>{strategy?.title ?? view.strategyId}</Text>
            {strategy?.summary ? <Text style={styles.summary}>{strategy.summary}</Text> : null}

            <View style={styles.headerRow}>
              <Text style={styles.h2}>Scenarios</Text>
              <Pressable
                style={styles.addButtonSmall}
                onPress={() =>
                  setEditState({
                    table: 'Scenarios',
                    rowId: null,
                    idField: 'ScenarioId',
                    fields: [
                      { key: 'ScenarioId', label: 'Scenario Id (slug)', kind: 'text' },
                      { key: 'Strategy', label: 'Strategy Id', kind: 'text' },
                      { key: 'Title', label: 'Title', kind: 'text' },
                      { key: 'Description', label: 'Description', kind: 'multiline' },
                    ],
                    values: { ScenarioId: '', Strategy: view.strategyId, Title: '', Description: '' },
                  })
                }
              >
                <Text style={styles.addButtonText}>+ Add</Text>
              </Pressable>
            </View>
            {strategyScenarios.map((s) => (
              <View key={s.scenario_id} style={styles.card}>
                <View style={styles.cardHeaderRow}>
                  <Text style={styles.cardTitle}>{s.title}</Text>
                  <Pressable
                    hitSlop={10}
                    onPress={() =>
                      setEditState({
                        table: 'Scenarios',
                        rowId: s.scenario_id,
                        idField: 'ScenarioId',
                        fields: [
                          { key: 'Title', label: 'Title', kind: 'text' },
                          { key: 'Description', label: 'Description', kind: 'multiline' },
                        ],
                        values: { Title: s.title, Description: s.description ?? '' },
                      })
                    }
                  >
                    <Text style={styles.pencil}>✏️</Text>
                  </Pressable>
                </View>
                {s.description ? <Text style={styles.cardBody}>{s.description}</Text> : null}
              </View>
            ))}

            <View style={styles.headerRow}>
              <Text style={styles.h2}>Pros ({pros.length})</Text>
              <Pressable
                style={styles.addButtonSmall}
                onPress={() =>
                  setEditState({
                    table: 'Considerations',
                    rowId: null,
                    idField: 'ConsiderationId',
                    fields: [
                      { key: 'ConsiderationId', label: 'Consideration Id (slug)', kind: 'text' },
                      { key: 'Strategy', label: 'Strategy Id', kind: 'text' },
                      { key: 'Statement', label: 'Statement', kind: 'multiline' },
                      { key: 'IsPro', label: 'Is Pro', kind: 'boolean' },
                    ],
                    values: { ConsiderationId: '', Strategy: view.strategyId, Statement: '', IsPro: true },
                  })
                }
              >
                <Text style={styles.addButtonText}>+ Add</Text>
              </Pressable>
            </View>
            {pros.map((c) => (
              <View key={c.consideration_id} style={[styles.card, styles.proCard]}>
                <View style={styles.cardHeaderRow}>
                  <Text style={styles.cardBody}>{c.statement}</Text>
                  <Pressable
                    hitSlop={10}
                    onPress={() =>
                      setEditState({
                        table: 'Considerations',
                        rowId: c.consideration_id,
                        idField: 'ConsiderationId',
                        fields: [
                          { key: 'Statement', label: 'Statement', kind: 'multiline' },
                          { key: 'IsPro', label: 'Is Pro', kind: 'boolean' },
                        ],
                        values: { Statement: c.statement, IsPro: c.is_pro },
                      })
                    }
                  >
                    <Text style={styles.pencil}>✏️</Text>
                  </Pressable>
                </View>
              </View>
            ))}

            <View style={styles.headerRow}>
              <Text style={styles.h2}>Cons ({cons.length})</Text>
              <Pressable
                style={styles.addButtonSmall}
                onPress={() =>
                  setEditState({
                    table: 'Considerations',
                    rowId: null,
                    idField: 'ConsiderationId',
                    fields: [
                      { key: 'ConsiderationId', label: 'Consideration Id (slug)', kind: 'text' },
                      { key: 'Strategy', label: 'Strategy Id', kind: 'text' },
                      { key: 'Statement', label: 'Statement', kind: 'multiline' },
                      { key: 'IsPro', label: 'Is Pro', kind: 'boolean' },
                    ],
                    values: { ConsiderationId: '', Strategy: view.strategyId, Statement: '', IsPro: false },
                  })
                }
              >
                <Text style={styles.addButtonText}>+ Add</Text>
              </Pressable>
            </View>
            {cons.map((c) => (
              <View key={c.consideration_id} style={[styles.card, styles.conCard]}>
                <View style={styles.cardHeaderRow}>
                  <Text style={styles.cardBody}>{c.statement}</Text>
                  <Pressable
                    hitSlop={10}
                    onPress={() =>
                      setEditState({
                        table: 'Considerations',
                        rowId: c.consideration_id,
                        idField: 'ConsiderationId',
                        fields: [
                          { key: 'Statement', label: 'Statement', kind: 'multiline' },
                          { key: 'IsPro', label: 'Is Pro', kind: 'boolean' },
                        ],
                        values: { Statement: c.statement, IsPro: c.is_pro },
                      })
                    }
                  >
                    <Text style={styles.pencil}>✏️</Text>
                  </Pressable>
                </View>
              </View>
            ))}
          </View>
        }
      />
      <EditModal state={editState} onClose={() => setEditState(null)} onSaved={reload} />
      <StatusBar style="auto" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
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
  addButton: {
    backgroundColor: '#3366cc',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  addButtonSmall: {
    backgroundColor: '#3366cc',
    borderRadius: 8,
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  addButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 13,
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
