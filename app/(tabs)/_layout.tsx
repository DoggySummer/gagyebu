import Header from "@/components/Header";
import { Colors } from "@/constants/colors";
import AntDesign from "@expo/vector-icons/AntDesign";
import Entypo from "@expo/vector-icons/Entypo";
import { Tabs } from "expo-router";
import React from "react";
export default function TabLayout() {
  return (
    <>
      <Header />
      <Tabs
        screenOptions={{
          tabBarActiveTintColor: Colors.PRIMARY,
          headerShown: false,
        }}
      >
        <Tabs.Screen
          name="wallet"
          options={{
            tabBarLabel: "가계부",
            tabBarIcon: ({ color, focused }) => (
              <Entypo name="wallet" size={24} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="statistics"
          options={{
            tabBarLabel: "통계",
            tabBarIcon: ({ color, focused }) => (
              <AntDesign name="piechart" size={24} color={color} />
            ),
          }}
        />
      </Tabs>
    </>
  );
}
