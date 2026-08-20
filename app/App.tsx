import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';

// Use your machine's LAN IP (not localhost) so phones on the same Wi-Fi can reach it.
const API = 'http://192.168.1.122:42441';

type Axis = {
  axis_id: string;
  title: string;
  summary: string | null;
  count_of_considerations: number;
  count_of_pros: number;
  count_of_cons: number;
};

type Scenario = {
  scenario_id: string;
  axis: string;
  title: string;
  description: string | null;
};

type Consideration = {
  consideration_id: string;
  axis: string;
  is_pro: boolean;
  statement: string;
  kind: string;
};

export default function App() {
  const [axes, setAxes] = useState<Axis[]>([]);
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [considerations, setConsiderations] = useState<Consideration[]>([]);
  const [selectedAxisId, setSelectedAxisId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetch(`${API}/api/tables/Axes`).then((r) => r.json()),
      fetch(`${API}/api/tables/Scenarios`).then((r) => r.json()),
      fetch(`${API}/api/tables/Considerations`).then((r) => r.json()),
    ])
      .then(([a, s, c]) => {
        setAxes(a.rows);
        setScenarios(s.rows);
        setConsiderations(c.rows);
      })
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
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

  const selectedAxis = axes.find((a) => a.axis_id === selectedAxisId) ?? null;

  if (selectedAxis) {
    const axisScenarios = scenarios.filter((s) => s.axis === selectedAxis.axis_id);
    const axisConsiderations = considerations.filter((c) => c.axis === selectedAxis.axis_id);
    const pros = axisConsiderations.filter((c) => c.is_pro);
    const cons = axisConsiderations.filter((c) => !c.is_pro);

    return (
      <SafeAreaView style={styles.container}>
        <FlatList
          data={[]}
          renderItem={null}
          ListHeaderComponent={
            <View style={styles.padded}>
              <Pressable onPress={() => setSelectedAxisId(null)}>
                <Text style={styles.backLink}>‹ All Axes</Text>
              </Pressable>

              <Text style={styles.h1}>{selectedAxis.title}</Text>
              {selectedAxis.summary ? (
                <Text style={styles.summary}>{selectedAxis.summary}</Text>
              ) : null}

              {axisScenarios.length > 0 && (
                <>
                  <Text style={styles.h2}>Scenarios</Text>
                  {axisScenarios.map((s) => (
                    <View key={s.scenario_id} style={styles.card}>
                      <Text style={styles.cardTitle}>{s.title}</Text>
                      {s.description ? (
                        <Text style={styles.cardBody}>{s.description}</Text>
                      ) : null}
                    </View>
                  ))}
                </>
              )}

              <Text style={styles.h2}>Pros ({pros.length})</Text>
              {pros.map((c) => (
                <View key={c.consideration_id} style={[styles.card, styles.proCard]}>
                  <Text style={styles.cardBody}>{c.statement}</Text>
                </View>
              ))}

              <Text style={styles.h2}>Cons ({cons.length})</Text>
              {cons.map((c) => (
                <View key={c.consideration_id} style={[styles.card, styles.conCard]}>
                  <Text style={styles.cardBody}>{c.statement}</Text>
                </View>
              ))}
            </View>
          }
        />
        <StatusBar style="auto" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        data={axes}
        keyExtractor={(item) => item.axis_id}
        ListHeaderComponent={<Text style={styles.h1}>AI in Education — Axes</Text>}
        contentContainerStyle={styles.padded}
        renderItem={({ item }) => (
          <Pressable style={styles.card} onPress={() => setSelectedAxisId(item.axis_id)}>
            <Text style={styles.cardTitle}>{item.title}</Text>
            {item.summary ? <Text style={styles.cardBody}>{item.summary}</Text> : null}
            <Text style={styles.counts}>
              {item.count_of_pros} pro · {item.count_of_cons} con
            </Text>
          </Pressable>
        )}
      />
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
  h1: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 12,
  },
  h2: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 20,
    marginBottom: 8,
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
  },
  cardBody: {
    fontSize: 14,
    color: '#333',
  },
  counts: {
    marginTop: 6,
    fontSize: 12,
    color: '#777',
  },
});
