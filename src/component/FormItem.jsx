import React from 'react';
import PropTypes from 'prop-types';
import BaseItem from './BaseItem';
import { ANY_CHANGE, EDIT, HIDDEN, FOCUS, BLUR } from '../static';
import genId from '../util/random';
import { isObject, isFunction } from '../util/is';
import FormContext from '../context/form';
import IfContext from '../context/if';
import ItemContext from '../context/item';

const formItemPrefix = 'no-form';
const noop = () => { };
const getValue = (jsxProps) => {
    const hasVal = ('value' in jsxProps);
    const hasDefaultVal = ('defaultValue' in jsxProps);
    if (hasVal) {
        return jsxProps.value;
    } else if (hasDefaultVal) {
        return jsxProps.defaultValue;
    }
    return null;
};

class BaseFormItem extends React.Component {
    static propTypes = {
        name: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
        value: PropTypes.any,
        children: PropTypes.any,
        onBlur: PropTypes.func,
        onFocus: PropTypes.func,
        render: PropTypes.func,
        inset: PropTypes.bool,
    }

    static defaultProps = {
        name: '',
        children: null,
        onBlur: noop,
        onFocus: noop,
    }

    constructor(props) {
        super(props);
        const { form, ifCore } = props;
        if (!form) {
            return this;
        }

        this.form = form;
        this.predictChildForm = this.handlePredictForm(props);
        this.core = this.initialCore(props);
        this.core.jsx = this;
        this.core.getSuperFormProps = this.getSuperFormProps.bind(this);

        this.ifCore = ifCore;
        this.id = `__noform__item__${genId()}`;
        if (props.name) {
            this.name = props.name;
        }
    }

    componentDidMount() { // 绑定set事件就会执行更新 TODO：优化渲染
        this.form.on(ANY_CHANGE, this.update);
        const { childForm } = this.core;
        console.log('===>>>>>', this.core, this.name);
        if (childForm && !childForm.disabledSyncChildForm) {
            this.form.setValueSilent(this.core.name, childForm.getAll('value'));
            this.form.setProps(this.core.name, childForm.getAll('props'));
            this.form.setStatus(this.core.name, childForm.getAll('status'));
            this.form.setError(this.core.name, childForm.getAll('error'));
            childForm.on(ANY_CHANGE, (type) => {
                if (type === 'value') {
                    return;
                }

                this.form.set(type, this.core.name, childForm.getAll(type));
            });
        }
        this.didMount = true;
        // this.forceUpdate();
    }

    componentWillUnmount() { // 解绑
        this.form.removeListener(ANY_CHANGE, this.update);
        this.didMount = false;
    }

    onChange = (e, opts = {}) => {
        const { escape = false } = opts; // 直接用原生对象不进行判断

        let val = e;
        if (!escape) {
            if (e && e.target) {
                if ('value' in e.target) {
                    val = e.target.value;
                } else if ('checked' in e.target) {
                    val = e.target.checked;
                }
            }

            if (isObject(val)) {
                const tmpStr = JSON.stringify(val);
                try {
                    val = JSON.parse(tmpStr);
                } catch (exception) {
                    val = {};
                }
            }
        }

        this.form.currentCore = this.core;
        this.form.currentEventOpts = opts;
        this.form.currentEventType = 'manual';
        this.core.set('value', val);
        Promise.resolve().then(() => {
            this.form.currentCore = null;
            this.form.currentEventOpts = null;
            this.form.currentEventType = 'api';
        });
    }

    onBlur = () => {
        this.core.emit(BLUR, this.core.name);
        if (typeof this.props.onBlur === 'function') {
            this.props.onBlur();
        }
    }
    onFocus = () => {
        this.core.emit(FOCUS, this.core.name);
        if (typeof this.props.onFocus === 'function') {
            this.props.onFocus();
        }
    }

    getBaseProps = () => {
        const {
            children, render,
            inset, style,
        } = this.props;

        const { form } = this;
        const { name } = this.core;

        let formProps = {};
        if (this.predictChildForm) {
            formProps = this.getSuperFormProps();
        }

        return {
            children,
            render,
            didMount: this.didMount,
            form: this.form,
            onChange: this.onChange,
            onBlur: this.onBlur,
            onFocus: this.onFocus,
            value: form.getItemValue(name),
            status: form.getItemStatus(name),
            props: form.getItemProps(name),
            error: form.getItemError(name),
            inset,
            style,
            name,
            formProps,
        };
    }

    getSuperFormProps = () => {
        let formProps = {};
        if (this.core.form && this.core.form.jsx.props) {
            const {
                defaultMinWidth, full, inline, inset, layout, colon,
            } = this.core.form.jsx.props;
            formProps = {
                defaultMinWidth, full, inline, inset, layout, colon,
            };
        }

        return formProps;
    }

    initialCore = (props) => {
        const {
            name, error, props: itemProps, status,
            form, ifCore,
        } = props;

        const value = getValue(props);

        const option = {
            error,
            value,
            name,
        };

        // 上有if item
        if (ifCore) {
            option.when = ifCore.when;
            option.parentIf = ifCore.parentIf;
        }

        // 处理props
        if ('props' in props) {
            if (isFunction(itemProps)) {
                option.func_props = itemProps;
                option.props = {};
            } else {
                option.props = itemProps;
            }
        } else {
            option.props = {};
        }

        // 处理status
        if ('status' in props) {
            if (isFunction(status)) {
                option.func_status = status;
            } else {
                option.status = status;
            }
        }

        // 校验规则, 拦截器，when, 及id
        ['validateConfig', 'interceptor', 'id', 'when'].forEach((key) => {
            if (key in props) {
                option[key] = props[key];
            }
        });

        const core = form.addField(option);
        return core;
    }

    handlePredictForm = (props) => {
        // 构建时提前知道子类，比didmount再来通知，把控性好很多
        const { children } = props;
        this.displayName = '';
        if (children) {
            if (React.isValidElement(children)) {
                const jsxComponent = React.Children.only(children);
                if (jsxComponent && jsxComponent.type && jsxComponent.type.displayName) {
                    this.displayName = jsxComponent.type.displayName;
                }
            }
        }

        const predictForm = this.displayName === 'NoForm';
        return predictForm;
    }

    update = (type, name, value, silent = false) => {
        if (this.props.noLayout && type === 'error') {
            return;
        }

        if (this.didMount && (this.props.render || this.core.name === name) && !silent) {
            this.forceUpdate();
        }
    }

    render() {
        const { noLayout, children, ...itemProps } = this.props;
        const {
            name, style = {},
            status: propStatus,
            error: propError,
        } = itemProps;
        console.log('[item render]**************', name);
        const restItemProps = { ...itemProps, id: this.id };
        delete restItemProps.style;
        restItemProps.form = this.form;
        restItemProps.ifCore = this.ifCore;

        const { className = '' } = itemProps;
        const props = this.form.getItemProps(name) || {}; // 动态props
        let status = this.form.getItemStatus(name); // 动态status
        let error = this.form.getItemError(name); // 动态error
        if (!name) {
            status = propStatus;
            error = propError;
        }

        // 保留item关键字属性
        const {
            errorRender, label, top, suffix, prefix, help, required, full: coreFull,
        } = { ...this.props, ...props };

        let errInfo = error;
        let hasError = !!errInfo;
        let hasMainError = !!errInfo;
        let hasSubError = false;
        if (isObject(error)) { // 对象的情况
            errInfo = error.__error || error.main;
            hasMainError = error.main;
            hasSubError = error.sub;
            hasError = hasMainError || hasSubError;
        }

        if (errorRender) {
            errInfo = errorRender(errInfo, error);
        }

        if (status === HIDDEN) {
            return null;
        }

        let requiredCls = '';
        if (required && (status === EDIT || `${name}` === '')) {
            requiredCls = ' required';
        }
        // 处理布局
        const {
            inline = false, inset = false, colon, layout = {}, full: jsxFull,
            defaultMinWidth = true,
        } = {
            ...this.form.jsx.props,
            ...itemProps,
        };

        const defaultMinCls = defaultMinWidth ? `${formItemPrefix}-item-default-width` : `${formItemPrefix}-item-no-default-width`;
        const full = jsxFull || coreFull || inset;
        const errCls = hasMainError ? `${formItemPrefix}-item-has-error` : '';
        const subErrCls = hasSubError ? `${formItemPrefix}-item-has-sub-error` : '';
        const insetCls = inset ? `${formItemPrefix}-item-inset` : '';
        const layoutCls = (layout.label && layout.control) ? `${formItemPrefix}-item-has-layout` : '';
        const colonCls = colon ? '' : `${formItemPrefix}-item-no-colon`;
        const inlineCls = inline ? `${formItemPrefix}-item-inline` : '';

        const baseProps = this.getBaseProps();
        const itemContext = { item: this.core };
        const baseElement = (<ItemContext.Provider value={itemContext}>
            <BaseItem {...baseProps} />
        </ItemContext.Provider>);
        if (noLayout) {
            return baseElement;
        }

        return (
            <div id={this.id} name={`form-item-${name}`} className={`${formItemPrefix}-item ${className} ${layoutCls} ${colonCls} ${inlineCls} ${defaultMinCls}`} style={style}>
                <div className={`${insetCls} ${errCls} ${subErrCls}`}>
                    <span className={`${formItemPrefix}-item-label ${requiredCls} ${layout.label ? `col-${layout.label}` : ''}`} >{label}</span>
                    <span className={`${formItemPrefix}-item-control ${layout.control ? `col-${layout.control}` : ''}`} >
                        { top ? <span className={`${formItemPrefix}-item-top`}>{top}</span> : null }
                        <span className={`${formItemPrefix}-item-content ${full ? `${formItemPrefix}-full` : ''}`}>
                            { prefix ? <span className={`${formItemPrefix}-item-content-prefix`}>{prefix}</span> : null }
                            <span className={`${formItemPrefix}-item-content-elem is-${status}`}>
                                {baseElement}
                            </span>
                            { suffix ? <span className={`${formItemPrefix}-item-content-suffix`}>{suffix}</span> : null }
                        </span>
                        { help ? <span className={`${formItemPrefix}-item-help`}>{help}</span> : null }
                        { (!inset && hasError) ? <span className={`${formItemPrefix}-item-error`}>{errInfo}</span> : null }
                    </span>
                </div>
                { (inset && hasError) ? <span className={`${formItemPrefix}-item-error`}>{errInfo}</span> : null }
            </div>
        );
    }
}

const ConnectFormItem = props => (<FormContext.Consumer>
    {(formContext) => {
        const { form } = formContext || {};
        return (
            <IfContext.Consumer>
                {(ifCoreContext) => {
                    const { if: ifCore } = ifCoreContext || {};
                    return (<BaseFormItem {...props} form={form} ifCore={ifCore} />);
                }}
            </IfContext.Consumer>
        );
    }}
</FormContext.Consumer>);

ConnectFormItem.displayName = 'FormItem';

export default ConnectFormItem;

