import { Observable } from "rx";

export interface WindowService {
    active: ActiveWindow
}

export interface ActiveWindow {
    cls: Observable<string>
    title: Observable<string>
}
