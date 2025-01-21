import { exec, Variable } from "astal"

const CPU = Variable("0")
  .poll(3000, () => exec("bash scripts/cpu.sh"))

const RAM = Variable("0")
  .poll(3000, () => exec("bash scripts/ram.sh"))

export const Status = () => <box>
  <box cssClasses={['bar-widget']}>
    <image iconName="utilities-system-monitor-symbolic"/>
    <label label={CPU().as(c => c + "%")} />
  </box>

  <box cssClasses={['bar-widget']}>
    <image iconName="system-software-install-symbolic"/>
    <label label={RAM().as(c => c + "%")} />
  </box>
</box>
