
"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useLanguage } from "@/components/language-provider";

type Notification = {
  id: string;
  request_id: string | null;
  type: string;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
};

export function NotificationBell() {
  const { locale } = useLanguage();
  const ar = locale === "ar";

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const loadNotifications = useCallback(async () => {
    const supabase = createClient();

    const { data: authData, error: authError } =
      await supabase.auth.getUser();

    if (authError || !authData.user) {
      setNotifications([]);
      setUnreadCount(0);
      return;
    }

    const userId = authData.user.id;

    const [listResult, countResult] = await Promise.all([
      supabase
        .from("notifications")
        .select(
          "id,request_id,type,title,message,is_read,created_at"
        )
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(20),

      supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("is_read", false),
    ]);

    if (listResult.error || countResult.error) {
      setError(
        ar
          ? "تعذر تحميل الإشعارات."
          : "Could not load notifications."
      );
      return;
    }

    setNotifications(listResult.data ?? []);
    setUnreadCount(countResult.count ?? 0);
    setError("");
  }, [ar]);

  useEffect(() => {
    void loadNotifications();

    const interval = setInterval(() => {
      void loadNotifications();
    }, 30000);

    return () => clearInterval(interval);
  }, [loadNotifications]);

  async function updateReadStatus(
    id: string
  ): Promise<boolean> {
    const supabase = createClient();

    const { data: authData, error: authError } =
      await supabase.auth.getUser();

    if (authError || !authData.user) {
      setError(
        ar
          ? "يجب تسجيل الدخول أولًا."
          : "Please sign in first."
      );
      return false;
    }

    const { error: updateError } = await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("id", id)
      .eq("user_id", authData.user.id);

    if (updateError) {
      setError(
        ar
          ? "تعذر تحديث الإشعار."
          : "Could not update notification."
      );
      return false;
    }

    return true;
  }

  async function markAsRead(id: string) {
    if (loading) return;

    setLoading(true);

    try {
      const success = await updateReadStatus(id);

      if (success) {
        await loadNotifications();
      }
    } finally {
      setLoading(false);
    }
  }

  async function markAllAsRead() {
    if (loading || unreadCount === 0) return;

    setLoading(true);

    try {
      const supabase = createClient();

      const { data: authData, error: authError } =
        await supabase.auth.getUser();

      if (authError || !authData.user) {
        setError(
          ar
            ? "يجب تسجيل الدخول أولًا."
            : "Please sign in first."
        );
        return;
      }

      const { error: updateError } = await supabase
        .from("notifications")
        .update({ is_read: true })
        .eq("user_id", authData.user.id)
        .eq("is_read", false);

      if (updateError) {
        setError(
          ar
            ? "تعذر تحديث الإشعارات."
            : "Could not update notifications."
        );
      } else {
        await loadNotifications();
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleViewRequest(
    notification: Notification
  ) {
    setOpen(false);

    if (!notification.is_read) {
      const success = await updateReadStatus(
        notification.id
      );

      if (success) {
        setNotifications((previous) =>
          previous.map((item) =>
            item.id === notification.id
              ? { ...item, is_read: true }
              : item
          )
        );

        setUnreadCount((previous) =>
          Math.max(0, previous - 1)
        );
      }
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => {
          setOpen((previous) => !previous);

          if (!open) {
            void loadNotifications();
          }
        }}
        aria-label={
          ar ? "الإشعارات" : "Notifications"
        }
        aria-expanded={open}
        className="relative flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 transition hover:bg-slate-50"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="21"
          height="21"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
          <path d="M10 21h4" />
        </svg>

        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 flex min-h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
            {unreadCount > 99
              ? "99+"
              : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          className="absolute end-0 top-14 z-50 w-[min(90vw,380px)] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl"
          dir={ar ? "rtl" : "ltr"}
        >
          <div className="flex items-center justify-between border-b border-slate-100 p-4">
            <h3 className="font-bold">
              {ar ? "الإشعارات" : "Notifications"}
            </h3>

            <button
              type="button"
              onClick={() => void markAllAsRead()}
              disabled={
                loading || unreadCount === 0
              }
              className="text-xs font-semibold text-blue-600 disabled:opacity-40"
            >
              {ar
                ? "تحديد الكل كمقروء"
                : "Mark all as read"}
            </button>
          </div>

          {error && (
            <p
              role="alert"
              className="px-4 py-3 text-sm text-red-600"
            >
              {error}
            </p>
          )}

          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <p className="p-8 text-center text-sm text-slate-500">
                {ar
                  ? "ما عندك إشعارات حاليًا."
                  : "No notifications yet."}
              </p>
            ) : (
              notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`border-b border-slate-100 p-4 ${
                    notification.is_read
                      ? "bg-white"
                      : "bg-blue-50/70"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {!notification.is_read && (
                      <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-blue-600" />
                    )}

                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-slate-900">
                        {notification.title}
                      </p>

                      <p className="mt-1 text-xs leading-5 text-slate-600">
                        {notification.message}
                      </p>

                      <p className="mt-2 text-[11px] text-slate-400">
                        {new Date(
                          notification.created_at
                        ).toLocaleString(
                          ar ? "ar-JO" : "en-US"
                        )}
                      </p>

                      <div className="mt-3 flex items-center gap-4">
                        {!notification.is_read && (
                          <button
                            type="button"
                            disabled={loading}
                            onClick={() =>
                              void markAsRead(
                                notification.id
                              )
                            }
                            className="text-xs font-semibold text-blue-600 disabled:opacity-50"
                          >
                            {ar
                              ? "تحديد كمقروء"
                              : "Mark as read"}
                          </button>
                        )}

                        {notification.request_id && (
                          <Link
                            href={`/dashboard/requests/${encodeURIComponent(
                              notification.request_id
                            )}`}
                            onClick={() => {
                              void handleViewRequest(
                                notification
                              );
                            }}
                            className="text-xs font-semibold text-slate-600 hover:text-blue-600"
                          >
                            {ar
                              ? "عرض الطلب"
                              : "View request"}
                          </Link>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
