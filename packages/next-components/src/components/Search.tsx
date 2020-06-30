import React from 'react'
import { Consumer } from '@alist/react'
import { createVirtualBox } from '@formily/next'
import { Submit } from '@formily/next'

const InternalSearch = (props) => {
    const { render, content, children, ...others } = props
    return <Consumer>
        {(list) => {
            if (list) {
                const { search } = list
                if (typeof render === 'function') {
                    return render(search)
                }

                return <Submit {...others} onClick={(...args) => {
                    const filterInstance = list.getFilterInstance()
                    if (!filterInstance) {
                        search()
                    }
                    if (typeof props.onClick === 'function') {
                        props.onClick(...args)   
                    }
                }} onSubmit={(values) => {
                    search()
                }}>
                    {content || children}
                </Submit>
            } else {
                return <Submit {...others}>{content || children}</Submit>
            }
        }}
    </Consumer>
}

createVirtualBox('search', InternalSearch)
const Search = createVirtualBox('alist-search', InternalSearch)

export {
    Search,
    InternalSearch,
}