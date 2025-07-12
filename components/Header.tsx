import { Ionicons } from "@expo/vector-icons"; // 아이콘용 라이브러리 (expo 내장)
import { useRouter } from "expo-router";
import { useState } from "react";
import { Text, TouchableOpacity, View } from "react-native";

export default function Header() {
  const router = useRouter();
  const [month, setMonth] = useState(7);
  const [year, setYear] = useState(2025);

  const increaseMonth = () => {
    if (month === 12) {
      setMonth(1);
      setYear((prev) => prev + 1);
    } else {
      setMonth((prev) => prev + 1);
    }
  };

  const decreaseMonth = () => {
    if (month === 1) {
      setMonth(12);
      setYear((prev) => prev - 1);
    } else {
      setMonth((prev) => prev - 1);
    }
  };

  const headerTabs = [
    { label: "일일", route: "/(tabs)/daily" as const },
    { label: "달력", route: "/(tabs)/calendar" as const },
    { label: "월별", route: "/(tabs)/monthly" as const },
  ];

  return (
    <View
      style={{
        paddingTop: 50,
        paddingBottom: 10,
        paddingHorizontal: 16,
        backgroundColor: "white",
        borderBottomWidth: 1,
        borderBottomColor: "#ddd",
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
      }}
    >
      {/* 달력 네비게이션 */}
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <TouchableOpacity onPress={decreaseMonth}>
          <Ionicons name="chevron-back" size={24} color="black" />
        </TouchableOpacity>
        <Text style={{ marginHorizontal: 8, fontWeight: "bold", fontSize: 16 }}>
          {year}년 {month}월
        </Text>
        <TouchableOpacity onPress={increaseMonth}>
          <Ionicons name="chevron-forward" size={24} color="black" />
        </TouchableOpacity>
      </View>

      {/* 헤더 탭 */}
      <View style={{ flexDirection: "row" }}>
        {headerTabs.map((tab) => (
          <TouchableOpacity key={tab.route} style={{ marginLeft: 12 }}>
            <Text style={{ fontSize: 14, color: "black" }}>{tab.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}
