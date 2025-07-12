import { Alert, StyleSheet, View } from "react-native";
import { Calendar } from "react-native-calendars";

export default function App() {
  const handleAddExpense = () => {
    Alert.alert("지출 추가됨!");
  };

  return (
    <View style={styles.container}>
      <Calendar
        onDayPress={(day) => {
          console.log("선택한 날짜:", day);
        }}
      />
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
