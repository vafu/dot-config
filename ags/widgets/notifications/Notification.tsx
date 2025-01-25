import { GLib } from "astal"
import { Gtk, Astal, Widget } from "astal/gtk4"
import Notifd from "gi://AstalNotifd"

// const isIcon = (icon: string) =>
//     !!Astal.Icon.lookup_icon(icon)

const fileExists = (path: string) =>
    GLib.file_test(path, GLib.FileTest.EXISTS)

const time = (time: number, format = "%H:%M") => GLib.DateTime
    .new_from_unix_local(time)
    .format(format)!

const urgency = (n: Notifd.Notification) => {
    const { LOW, NORMAL, CRITICAL } = Notifd.Urgency
    // match operator when?
    switch (n.urgency) {
        case LOW: return "low"
        case CRITICAL: return "critical"
        case NORMAL:
        default: return "normal"
    }
}

type Props = {
    setup(self: Astal.Box): void
    onHoverLost(self: Astal.Box): void
    notification: Notifd.Notification
}

export default function Notification(props: Props) {
    const { notification: n, onHoverLost, setup } = props
    const { START, CENTER, END } = Gtk.Align

    return <box
        cssClasses={["Notification", "${urgency(n)}"]}
        setup={setup}
        onHoverLeave={onHoverLost}>
        <box vertical>
            <box cssClasses={["header"]}>
                {(n.appIcon || n.desktopEntry) && <image
                    cssClasses={["app-icon"]}
                    visible={Boolean(n.appIcon || n.desktopEntry)}
                    iconName={n.appIcon || n.desktopEntry}
                />}
                <label
                    cssClasses={["app-name"]}
                    halign={START}
                    label={n.appName || "Unknown"}
                />
                <label
                    cssClasses={["time"]}
                    hexpand
                    halign={END}
                    label={time(n.time)}
                />
                <button onClicked={() => n.dismiss()}>
                    <image iconName="window-close-symbolic" />
                </button>
            </box>
            <Gtk.Separator visible />
            <box cssClasses={["content"]}>
                {n.image && fileExists(n.image) && <box
                    valign={START}
                    cssClasses={["image"]}
                    // css={`background-image: url('${n.image}')`}
                />}
                {n.image && isIcon(n.image) && <box
                    hexpand={false}
                    valign={START}
                    cssClasses={["icon-image"]}>
                    <image iconName={n.image} hexpand={true} halign={CENTER} valign={CENTER} />
                </box>}
                <box vertical>
                    <label
                        cssClasses={["summary"]}
                        halign={START}
                        xalign={0}
                        label={n.summary}
                    />
                    {n.body && <label
                        cssClasses={["body"]}
                        wrap
                        useMarkup
                        halign={START}
                        xalign={0}
                        label={n.body}
                        justify={Gtk.Justification.FILL}
                    />}
                </box>
            </box>
            {n.get_actions().length > 0 && <box cssClasses={["actions"]}>
                {n.get_actions().map(({ label, id }) => (
                    <button
                        hexpand
                        onClicked={() => n.invoke(id)}>
                        <label label={label} halign={CENTER} hexpand />
                    </button>
                ))}
            </box>}
        </box>
    </box>
}
