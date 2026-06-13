import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { Bell, CalendarDays, Clock, Coins, EyeOff, Power, Settings, SunMedium, Umbrella } from "lucide-react";
import { DEFAULT_SETTINGS } from "../shared/constants.js";
import type { AppSettings, DashboardState, HolidayItem, PetInfoKey, WorkBuddyApi } from "../shared/types.js";
import { getNextHoliday, getNextPayday, getNextRestDay, getWorkCountdown, mergeSettings } from "../shared/time.js";
import "./styles.css";

const fallbackApi: WorkBuddyApi = {
  async getSettings() {
    const raw = localStorage.getItem("workbuddy.settings");
    return mergeSettings(raw ? JSON.parse(raw) : DEFAULT_SETTINGS);
  },
  async saveSettings(settings: AppSettings) {
    localStorage.setItem("workbuddy.settings", JSON.stringify(settings));
    return settings;
  },
  async getHolidays(year: number): Promise<{ source: "fallback"; holidays: HolidayItem[] }> {
    return {
      source: "fallback",
      holidays: [
        { date: `${year}-01-01`, name: "元旦", isOffDay: true },
        { date: `${year}-05-01`, name: "劳动节", isOffDay: true },
        { date: `${year}-10-01`, name: "国庆节", isOffDay: true }
      ]
    };
  },
  async openSettings() {},
  async hidePet() {},
  async quit() {},
  onSettingsChanged(_callback) {
    return () => {};
  }
};

const api = window.workBuddy ?? fallbackApi;

function useSettings() {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    api.getSettings().then((value) => {
      setSettings(value);
      setReady(true);
    });
    return api.onSettingsChanged((next) => setSettings(next));
  }, []);

  const save = async (next: AppSettings) => {
    setSettings(next);
    await api.saveSettings(next);
  };

  return { settings, save, ready };
}

function useDashboard(settings: AppSettings) {
  const [now, setNow] = useState(new Date());
  const [holidayItems, setHolidayItems] = useState<HolidayItem[]>([]);
  const [holidaySource, setHolidaySource] = useState<"network" | "cache" | "fallback">("fallback");

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    api.getHolidays(now.getFullYear()).then(({ source, holidays }) => {
      setHolidaySource(source);
      setHolidayItems(holidays);
    });
  }, [now.getFullYear()]);

  return useMemo<DashboardState>(
    () => ({
      work: getWorkCountdown(now, settings),
      payday: getNextPayday(now, settings),
      restDay: getNextRestDay(now, settings),
      holiday: getNextHoliday(now, holidayItems, holidaySource)
    }),
    [holidayItems, holidaySource, now, settings]
  );
}

function Dashboard({ state, settings }: { state: DashboardState; settings: AppSettings }) {
  const holidayText = state.holiday.next
    ? `${state.holiday.next.name}还有 ${Math.max(0, state.holiday.daysLeft ?? 0)} 天`
    : "暂无节假日数据";

  return (
    <section className="dashboard">
      <Metric icon={<Clock />} label={state.work.label} value={state.work.display} tone="orange" />
      <Metric
        icon={<Coins />}
        label={state.payday.isToday ? "今天是发薪日" : "发薪日"}
        value={state.payday.isToday ? "今天" : `${state.payday.daysLeft} 天`}
        tone="green"
        note={state.payday.note}
      />
      <Metric icon={<Umbrella />} label="下次休息" value={state.restDay.daysLeft === 0 ? "今天" : `${state.restDay.daysLeft} 天`} tone="pink" />
      <Metric icon={<CalendarDays />} label="法定节假日" value={holidayText} tone="blue" note={`数据：${sourceLabel(state.holiday.source)}`} />
      <div className="balance">当前调休余额：{settings.restDay.compBalance} 天</div>
    </section>
  );
}

function sourceLabel(source: string) {
  return source === "network" ? "联网" : source === "cache" ? "缓存" : "备用";
}

function Metric({
  icon,
  label,
  value,
  tone,
  note
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone: "orange" | "green" | "pink" | "blue";
  note?: string;
}) {
  return (
    <article className={`metric ${tone}`}>
      <div className="metricIcon">{icon}</div>
      <div>
        <div className="metricLabel">{label}</div>
        <div className="metricValue">{value}</div>
        {note ? <div className="metricNote">{note}</div> : null}
      </div>
    </article>
  );
}

function SettingsApp() {
  const { settings, save, ready } = useSettings();
  const state = useDashboard(settings);
  const [tab, setTab] = useState("work");

  if (!ready) return <div className="loading">加载中...</div>;

  return (
    <main className="appShell">
      <header className="topbar">
        <div>
          <h1>打工人生存助手</h1>
          <p>下班、发薪、休息日和假期提醒都放在一个安静的桌面角落。</p>
        </div>
        <button className="iconButton" title="退出" onClick={() => api.quit()}>
          <Power size={18} />
        </button>
      </header>
      <Dashboard state={state} settings={settings} />
      <HolidayPopup state={state} settings={settings} save={save} />
      <div className="settingsLayout">
        <nav className="tabs">
          {[
            ["work", "工作时间", Clock],
            ["payday", "发薪日", Coins],
            ["rest", "休息日", Umbrella],
            ["pet", "桌面宠物", SunMedium],
            ["general", "通用", Bell],
            ["about", "关于", Settings]
          ].map(([key, label, Icon]) => (
            <button key={key as string} className={tab === key ? "active" : ""} onClick={() => setTab(key as string)}>
              <Icon size={18} />
              {label as string}
            </button>
          ))}
        </nav>
        <section className="panel">
          {tab === "work" && <WorkSettings settings={settings} save={save} />}
          {tab === "payday" && <PaydaySettings settings={settings} save={save} />}
          {tab === "rest" && <RestSettings settings={settings} save={save} />}
          {tab === "pet" && <PetSettings settings={settings} save={save} />}
          {tab === "general" && <GeneralSettings settings={settings} save={save} />}
          {tab === "about" && <About />}
        </section>
      </div>
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}

function WorkSettings({ settings, save }: FormProps) {
  const update = (next: Partial<AppSettings["workTime"]>) => save({ ...settings, workTime: { ...settings.workTime, ...next } });
  const updateRange = (season: "winter" | "summer", key: "start" | "end", value: string) =>
    update({ [season]: { ...settings.workTime[season], [key]: value } });

  return (
    <div className="formGrid">
      <h2>工作时间设置</h2>
      <div className="segmented">
        <button className={settings.workTime.currentSeason === "summer" ? "selected" : ""} onClick={() => update({ currentSeason: "summer" })}>
          夏季时间
        </button>
        <button className={settings.workTime.currentSeason === "winter" ? "selected" : ""} onClick={() => update({ currentSeason: "winter" })}>
          冬季时间
        </button>
      </div>
      <Field label="夏季上班"><input type="time" value={settings.workTime.summer.start} onChange={(e) => updateRange("summer", "start", e.target.value)} /></Field>
      <Field label="夏季下班"><input type="time" value={settings.workTime.summer.end} onChange={(e) => updateRange("summer", "end", e.target.value)} /></Field>
      <Field label="冬季上班"><input type="time" value={settings.workTime.winter.start} onChange={(e) => updateRange("winter", "start", e.target.value)} /></Field>
      <Field label="冬季下班"><input type="time" value={settings.workTime.winter.end} onChange={(e) => updateRange("winter", "end", e.target.value)} /></Field>
      <Field label="午休开始"><input type="time" value={settings.breakTime.start} onChange={(e) => save({ ...settings, breakTime: { ...settings.breakTime, start: e.target.value } })} /></Field>
      <Field label="午休结束"><input type="time" value={settings.breakTime.end} onChange={(e) => save({ ...settings, breakTime: { ...settings.breakTime, end: e.target.value } })} /></Field>
    </div>
  );
}

function PaydaySettings({ settings, save }: FormProps) {
  const days = settings.payday.days.join(",");
  return (
    <div className="formGrid">
      <h2>发薪日设置</h2>
      <Field label="每月发薪日">
        <input
          value={days}
          placeholder="15,30"
          onChange={(e) =>
            save({
              ...settings,
              payday: {
                days: e.target.value
                  .split(",")
                  .map((v) => Number(v.trim()))
                  .filter((v) => Number.isInteger(v) && v >= 1 && v <= 31)
              }
            })
          }
        />
      </Field>
      <p className="hint">可输入多个日期，用英文逗号分隔。遇到周末会自动顺延到下一个工作日。</p>
    </div>
  );
}

function RestSettings({ settings, save }: FormProps) {
  return (
    <div className="formGrid">
      <h2>休息日设置</h2>
      <div className="segmented">
        {[
          ["double", "双休"],
          ["single", "单休"],
          ["custom", "自定义"]
        ].map(([value, label]) => (
          <button
            key={value}
            className={settings.restDay.type === value ? "selected" : ""}
            onClick={() => save({ ...settings, restDay: { ...settings.restDay, type: value as AppSettings["restDay"]["type"] } })}
          >
            {label}
          </button>
        ))}
      </div>
      <Field label="调休余额">
        <input
          type="number"
          min="0"
          value={settings.restDay.compBalance}
          onChange={(e) => save({ ...settings, restDay: { ...settings.restDay, compBalance: Number(e.target.value) } })}
        />
      </Field>
      <p className="hint">自定义休息日暂按周日兜底，可在后续版本扩展为星期多选。</p>
    </div>
  );
}

function PetSettings({ settings, save }: FormProps) {
  const toggle = (key: PetInfoKey) => {
    const set = new Set(settings.pet.showItems);
    set.has(key) ? set.delete(key) : set.add(key);
    save({ ...settings, pet: { ...settings.pet, showItems: [...set] } });
  };

  return (
    <div className="formGrid">
      <h2>桌面宠物设置</h2>
      <Field label="透明度">
        <input
          type="range"
          min="50"
          max="100"
          value={settings.pet.opacity}
          onChange={(e) => save({ ...settings, pet: { ...settings.pet, opacity: Number(e.target.value) } })}
        />
      </Field>
      <Field label="大小">
        <input
          type="range"
          min="96"
          max="150"
          value={settings.pet.size}
          onChange={(e) => save({ ...settings, pet: { ...settings.pet, size: Number(e.target.value) } })}
        />
      </Field>
      <div className="checkGrid">
        {[
          ["offWork", "下班倒计时"],
          ["payday", "发薪日"],
          ["holiday", "法定节假日"],
          ["restDay", "下次休息"]
        ].map(([key, label]) => (
          <label key={key} className="check">
            <input type="checkbox" checked={settings.pet.showItems.includes(key as PetInfoKey)} onChange={() => toggle(key as PetInfoKey)} />
            {label}
          </label>
        ))}
      </div>
      <button className="primary" onClick={() => save({ ...settings, pet: { ...settings.pet, position: { x: 100, y: 100 }, visible: true } })}>
        重置宠物位置
      </button>
    </div>
  );
}

function GeneralSettings({ settings, save }: FormProps) {
  return (
    <div className="formGrid">
      <h2>通用设置</h2>
      <label className="switch"><input type="checkbox" checked={settings.autoStart} onChange={(e) => save({ ...settings, autoStart: e.target.checked })} />开机自启动</label>
      <label className="switch">
        <input
          type="checkbox"
          checked={settings.notifications.enabled}
          onChange={(e) => save({ ...settings, notifications: { ...settings.notifications, enabled: e.target.checked } })}
        />
        系统通知
      </label>
      <label className="switch">
        <input
          type="checkbox"
          checked={settings.notifications.offWorkSound}
          onChange={(e) => save({ ...settings, notifications: { ...settings.notifications, offWorkSound: e.target.checked } })}
        />
        下班音效
      </label>
    </div>
  );
}

function About() {
  return (
    <div className="about">
      <h2>关于</h2>
      <p>版本 0.1.0</p>
      <p>为 Windows 日常办公设计的桌面助手。数据优先本地保存，节假日数据可联网更新并缓存。</p>
    </div>
  );
}

type FormProps = {
  settings: AppSettings;
  save: (settings: AppSettings) => Promise<void>;
};

function HolidayPopup({ state, settings, save }: { state: DashboardState } & FormProps) {
  const today = new Date().toISOString().slice(0, 10);
  const holiday = state.holiday.next;
  const shouldShow = holiday && (state.holiday.daysLeft ?? 99) >= 0 && (state.holiday.daysLeft ?? 99) <= 3 && settings.holidayPopup.lastShownDate !== today;
  const [open, setOpen] = useState(false);
  const [confetti, setConfetti] = useState(false);

  useEffect(() => setOpen(Boolean(shouldShow)), [shouldShow]);
  if (!holiday || !open) return null;

  const choose = async (days: number) => {
    setConfetti(days === holiday.days);
    await save({
      ...settings,
      restDay: { ...settings.restDay, compBalance: settings.restDay.compBalance + Math.max(0, days - holiday.days) },
      holidayPopup: {
        ...settings.holidayPopup,
        lastShownDate: today,
        selectedExtraDays: { ...settings.holidayPopup.selectedExtraDays, [holiday.key]: days }
      }
    });
    window.setTimeout(() => setOpen(false), days === holiday.days ? 1300 : 200);
  };

  return (
    <div className="modalBackdrop">
      {confetti ? <div className="confetti">实名羡慕好公司！</div> : null}
      <div className="modal">
        <h2>假期即将到来！</h2>
        <p>
          {holiday.name}：{holiday.start} 至 {holiday.end}，共 {holiday.days} 天
        </p>
        <button className="primary" onClick={() => choose(holiday.days)}>
          严格按照法定节假日休息（休 {holiday.days} 天）
        </button>
        <button onClick={() => choose(holiday.days + 1)}>休 {holiday.days + 1} 天</button>
        <button onClick={() => choose(holiday.days + 2)}>休 {holiday.days + 2} 天</button>
      </div>
    </div>
  );
}

function PetApp() {
  const { settings } = useSettings();
  const state = useDashboard(settings);
  const [index, setIndex] = useState(0);
  const items = settings.pet.showItems.length ? settings.pet.showItems : ["offWork"];
  const current = items[index % items.length];
  const info = getPetInfo(current, state);

  return (
    <main className="petStage" onClick={() => setIndex(index + 1)} onContextMenu={(event) => event.preventDefault()}>
      <button className="petHide" title="隐藏宠物" onClick={(event) => { event.stopPropagation(); api.hidePet(); }}>
        <EyeOff size={14} />
      </button>
      <div className="petBubble" style={{ width: settings.pet.size, height: settings.pet.size }}>
        <div className="ear left" />
        <div className="ear right" />
        <div className="face">
          <span className="eye left" />
          <span className="eye right" />
          <span className="mouth" />
        </div>
      </div>
      <div className="petCard">
        <div className="petLabel">{info.label}</div>
        <div className="petValue">{info.value}</div>
      </div>
    </main>
  );
}

function getPetInfo(key: PetInfoKey, state: DashboardState) {
  if (key === "payday") return { label: "发薪日", value: state.payday.isToday ? "今天" : `${state.payday.daysLeft} 天` };
  if (key === "holiday") return { label: state.holiday.next?.name ?? "节假日", value: state.holiday.daysLeft == null ? "待更新" : `${state.holiday.daysLeft} 天` };
  if (key === "restDay") return { label: "下次休息", value: state.restDay.daysLeft === 0 ? "今天" : `${state.restDay.daysLeft} 天` };
  return { label: state.work.label, value: state.work.display };
}

function Root() {
  const route = window.location.hash.replace("#", "");
  return route === "/pet" ? <PetApp /> : <SettingsApp />;
}

createRoot(document.getElementById("root")!).render(<Root />);
