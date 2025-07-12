import { Alert, Button, StyleSheet, Text, View } from "react-native";

export default function App() {
  const handleAddExpense = () => {
    Alert.alert("지출 추가됨!");
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>가계부 앱</Text>
      <Button title="지출 추가" onPress={handleAddExpense} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 20,
  },
});
